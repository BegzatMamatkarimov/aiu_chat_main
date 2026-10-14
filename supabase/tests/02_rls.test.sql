begin;

-- Данные (суперпользователь)
create temp table _ids (k text primary key, v uuid);
grant select on _ids to authenticated, anon;

insert into _ids select k, gen_random_uuid() from unnest(array[
  'a','b','c','g1','g2','d','m1','m2','m3'
]) k;

do $$
declare
  a uuid := (select v from _ids where k = 'a');
  b uuid := (select v from _ids where k = 'b');
  c uuid := (select v from _ids where k = 'c');
  g1 uuid := (select v from _ids where k = 'g1');
  g2 uuid := (select v from _ids where k = 'g2');
  d uuid := (select v from _ids where k = 'd');
  m1 uuid := (select v from _ids where k = 'm1');
  m2 uuid := (select v from _ids where k = 'm2');
  m3 uuid := (select v from _ids where k = 'm3');
begin
  insert into auth.users (id, email) values (a, 'a@x.kz'), (b, 'b@x.kz'), (c, 'c@x.kz');

  insert into public.chats (id, type, name, is_public) values
    (g1, 'group', 'G1', true),
    (g2, 'group', 'G2', false);
  insert into public.chats (id, type, is_public) values (d, 'direct', false);

  insert into public.chat_members (chat_id, user_id, role) values
    (g1, a, 'admin'), (g1, b, 'member'),
    (g2, a, 'admin'),
    (d, a, 'member'), (d, b, 'member');

  insert into public.direct_pairs (user_a, user_b, chat_id) values (least(a, b), greatest(a, b), d);

  insert into public.messages (id, chat_id, sender_id, body) values
    (m1, g1, a, 'in g1'), (m2, g2, a, 'in g2'), (m3, d, a, 'in d');
  insert into public.attachments (message_id, chat_id, kind, storage_path, mime, size_bytes)
  values (m1, g1, 'image', g1 || '/' || m1 || '/p.png', 'image/png', 100);
  insert into public.reactions (message_id, chat_id, user_id, emoji) values (m1, g1, a, '+');
end $$;

-- C: видимость до вступления
set local role authenticated;
do $$
declare
  c uuid := (select v from _ids where k = 'c');
  g1 uuid := (select v from _ids where k = 'g1');
  g2 uuid := (select v from _ids where k = 'g2');
  d uuid := (select v from _ids where k = 'd');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.chats where id = g1) then raise exception 'C does not see public G1'; end if;
  if exists (select 1 from public.chats where id in (g2, d)) then raise exception 'C sees G2 or D'; end if;
  if exists (select 1 from public.messages where chat_id = g1) then raise exception 'C sees G1 messages before join'; end if;
  if exists (select 1 from public.attachments where chat_id = g1) then raise exception 'C sees G1 attachments before join'; end if;
  if exists (select 1 from public.reactions where chat_id = g1) then raise exception 'C sees G1 reactions before join'; end if;
end $$;
reset role;

-- C: вступление
set local role authenticated;
do $$
declare
  c uuid := (select v from _ids where k = 'c');
  g1 uuid := (select v from _ids where k = 'g1');
  g2 uuid := (select v from _ids where k = 'g2');
  failed boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);

  failed := false;
  begin
    insert into public.chat_members (chat_id, user_id, role) values (g1, c, 'admin');
  exception when others then failed := true; end;
  if not failed then raise exception 'C inserted self as admin'; end if;

  failed := false;
  begin
    insert into public.chat_members (chat_id, user_id, role) values (g2, c, 'member');
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'C joined private G2'; end if;

  insert into public.chat_members (chat_id, user_id, role) values (g1, c, 'member');
  if not exists (select 1 from public.messages where chat_id = g1) then raise exception 'C does not see G1 messages after join'; end if;
  if not exists (select 1 from public.attachments where chat_id = g1) then raise exception 'C does not see G1 attachments after join'; end if;
  if not exists (select 1 from public.reactions where chat_id = g1) then raise exception 'C does not see G1 reactions after join'; end if;
end $$;
reset role;

-- B: не админ
set local role authenticated;
do $$
declare
  b uuid := (select v from _ids where k = 'b');
  c uuid := (select v from _ids where k = 'c');
  g1 uuid := (select v from _ids where k = 'g1');
  n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  update public.chats set name = 'Hacked' where id = g1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B updated G1'; end if;

  delete from public.chat_members where chat_id = g1 and user_id = c;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B removed C'; end if;

  update public.chat_members set role = 'admin' where chat_id = g1 and user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B promoted self'; end if;

  delete from public.chats where id = g1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B deleted G1'; end if;
end $$;
reset role;

-- A: админ
set local role authenticated;
do $$
declare
  a uuid := (select v from _ids where k = 'a');
  b uuid := (select v from _ids where k = 'b');
  c uuid := (select v from _ids where k = 'c');
  g1 uuid := (select v from _ids where k = 'g1');
  d uuid := (select v from _ids where k = 'd');
  n int;
  failed boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a,'role', 'authenticated')::text, true);

  update public.chats set name = 'G1 renamed' where id = g1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A could not rename G1'; end if;

  update public.chats set name = 'x' where id = d;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A updated direct chat'; end if;

  delete from public.chat_members where chat_id = g1 and user_id = c;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A could not remove C'; end if;

  update public.chat_members set role = 'admin' where chat_id = g1 and user_id = b;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A could not promote B'; end if;

  failed := false;
  begin
    update public.chat_members set role = 'member' where chat_id = g1 and user_id = a;
    get diagnostics n = row_count;
    if n <> 0 then failed := false; else failed := true; end if;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'A changed own role'; end if;
end $$;
reset role;

-- B (теперь админ) выходит сам
set local role authenticated;
do $$
declare
  b uuid := (select v from _ids where k = 'b');
  g1 uuid := (select v from _ids where k = 'g1');
  n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  delete from public.chat_members where chat_id = g1 and user_id = b;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'B could not leave G1'; end if;
end $$;
reset role;

-- Профили
set local role authenticated;
do $$
declare
  a uuid := (select v from _ids where k = 'a');
  b uuid := (select v from _ids where k = 'b');
  n int;
  failed boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  update public.profiles set display_name = 'Hacked' where id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B updated profile of A'; end if;

  update public.profiles set display_name = 'Bob' where id = b;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'B could not update own profile'; end if;

  failed := false;
  begin
    update public.profiles set id = gen_random_uuid() where id = b;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'B changed own id'; end if;
end $$;
reset role;

-- Прямые записи запрещены
set local role authenticated;
do $$
declare
  a uuid := (select v from _ids where k = 'a');
  g1 uuid := (select v from _ids where k = 'g1');
  m1 uuid := (select v from _ids where k = 'm1');
  failed boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  failed := false;
  begin
    insert into public.messages (id, chat_id, sender_id, body) values (gen_random_uuid(), g1, a, 'x');
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'direct insert into messages allowed'; end if;

  failed := false;
  begin
    insert into public.reactions (message_id, chat_id, user_id, emoji) values (m1, g1, a, 'x');
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'direct insert into reactions allowed'; end if;

  failed := false;
  begin
    insert into public.attachments (message_id, chat_id, kind, storage_path, mime, size_bytes)
    values (m1, g1, 'image', 'p/q/r.png', 'image/png', 1);
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'direct insert into attachments allowed'; end if;

  failed := false;
  begin
    insert into public.chats (type, name) values ('group', 'Mine');
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'direct insert into chats allowed'; end if;
end $$;
reset role;

-- direct_pairs
set local role authenticated;
do $$
declare
  a uuid := (select v from _ids where k = 'a');
  c uuid := (select v from _ids where k = 'c');
  n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.direct_pairs;
  if n <> 0 then raise exception 'C sees % direct_pairs', n; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.direct_pairs;
  if n <> 1 then raise exception 'A sees % direct_pairs', n; end if;
end $$;
reset role;

-- anon
set local role anon;
do $$
declare
  failed boolean := false;
begin
  begin
    perform 1 from public.profiles limit 1;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'anon can read profiles'; end if;
end $$;
reset role;

rollback;
