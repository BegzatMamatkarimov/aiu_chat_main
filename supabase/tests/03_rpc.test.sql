begin;

create temp table _s (k text primary key, v text);
grant all on _s to authenticated, anon;

insert into _s select k, gen_random_uuid()::text from unnest(array['a','b','c','x']) k;
insert into auth.users (id, email, raw_user_meta_data)
select v::uuid, k || '@x.kz', json_build_object('full_name', 'User ' || upper(k))::jsonb
from _s where k in ('a','b','c');

-- ===== A: create_group, пустое имя =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  g public.chats;
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  g := public.create_group('  Algorithms and Data  ', 'desc', true);
  if g.name <> 'Algorithms and Data' or g.type <> 'group' or g.created_by <> a then
    raise exception 'create_group wrong row';
  end if;
  if not exists (select 1 from public.chat_members where chat_id = g.id and user_id = a and role = 'admin') then
    raise exception 'A is not admin';
  end if;
  insert into _s values ('g', g.id::text), ('code', g.invite_code);

  g := public.create_group('Secret Algorithms', null, false);
  insert into _s values ('gp', g.id::text);

  begin perform public.create_group('   '); exception when others then failed := true; end;
  if not failed then raise exception 'empty group name accepted'; end if;
end $$;
reset role;

-- ===== B, C: join_chat_by_code =====
set local role authenticated;
do $$
declare
  b uuid := (select v::uuid from _s where k = 'b');
  c uuid := (select v::uuid from _s where k = 'c');
  g uuid := (select v::uuid from _s where k = 'g');
  code text := (select v from _s where k = 'code');
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  if public.join_chat_by_code(code) <> g then raise exception 'join returned wrong id'; end if;
  if public.join_chat_by_code(code) <> g then raise exception 'second join failed'; end if;
  if (select count(*) from public.chat_members where chat_id = g and user_id = c) <> 1 then
    raise exception 'C membership duplicated';
  end if;
  begin perform public.join_chat_by_code('nope-nope'); exception when sqlstate 'P0002' then failed := true; end;
  if not failed then raise exception 'bad code accepted'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.join_chat_by_code(code);
end $$;
reset role;

-- ===== direct chat =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  x uuid := (select v::uuid from _s where k = 'x');
  d1 uuid;
  d2 uuid;
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  d1 := public.get_or_create_direct_chat(b);
  insert into _s values ('d', d1::text);

  begin perform public.get_or_create_direct_chat(a); exception when sqlstate '22023' then failed := true; end;
  if not failed then raise exception 'self direct accepted'; end if;
  failed := false;
  begin perform public.get_or_create_direct_chat(x); exception when sqlstate 'P0002' then failed := true; end;
  if not failed then raise exception 'unknown peer accepted'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  d2 := public.get_or_create_direct_chat(a);
  if d1 <> d2 then raise exception 'direct ids differ'; end if;

  delete from public.chat_members where chat_id = d1 and user_id = b;
  if public.is_chat_member(d1) then raise exception 'B still member after leave'; end if;
  d2 := public.get_or_create_direct_chat(a);
  if d1 <> d2 or not public.is_chat_member(d1) then raise exception 'B not restored'; end if;
end $$;
reset role;

do $$
begin
  if (select count(*) from public.direct_pairs) <> 1 then raise exception 'expected 1 direct pair'; end if;
  if (select count(*) from public.chats where type = 'direct') <> 1 then raise exception 'expected 1 direct chat'; end if;
end $$;

-- Подготовка: у B last_read_at в прошлом (всё в одной транзакции, now() одинаков)
update public.chat_members set last_read_at = now() - interval '1 hour';
update public.chats set last_message_at = now() - interval '1 day';

-- ===== send_message =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  c uuid := (select v::uuid from _s where k = 'c');
  g uuid := (select v::uuid from _s where k = 'g');
  d uuid := (select v::uuid from _s where k = 'd');
  m1 uuid := gen_random_uuid();
  m2 uuid := gen_random_uuid();
  m3 uuid := gen_random_uuid();
  md uuid := gen_random_uuid();
  p1 jsonb;
  p2 jsonb;
  failed boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  failed := false;
  begin perform public.send_message(gen_random_uuid(), d, 'hi'); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'C sent to foreign direct'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  p1 := public.send_message(m1, g, '  hello  ');
  if p1 -> 'sender' ->> 'display_name' <> 'User A' or p1 ->> 'body' <> 'hello' then
    raise exception 'bad payload %', p1;
  end if;
  if jsonb_array_length(p1 -> 'attachments') <> 0 or jsonb_array_length(p1 -> 'reactions') <> 0 then
    raise exception 'payload arrays not empty';
  end if;
  insert into _s values ('m1', m1::text), ('p1', p1::text);

  -- идемпотентность
  p2 := public.send_message(m1, g, '  hello  ');
  if p2 <> p1 then raise exception 'idempotent payload differs'; end if;

  failed := false;
  begin perform public.send_message(gen_random_uuid(), g, '   '); exception when sqlstate '22023' then failed := true; end;
  if not failed then raise exception 'empty message accepted'; end if;

  failed := false;
  begin
    perform public.send_message(gen_random_uuid(), g, 'x', null,
      jsonb_build_array(jsonb_build_object('kind','image','storage_path', g || '/' || gen_random_uuid() || '/a.png','mime','image/png','size_bytes',10)));
  exception when sqlstate '22023' then failed := true; end;
  if not failed then raise exception 'foreign storage_path accepted'; end if;

  failed := false;
  begin
    perform public.send_message(gen_random_uuid(), g, 'x', null,
      jsonb_build_array(jsonb_build_object('kind','image','storage_path', g || '/' || m2 || '/../a.png','mime','image/png','size_bytes',10)));
  exception when sqlstate '22023' then failed := true; end;
  if not failed then raise exception 'path traversal accepted'; end if;

  p2 := public.send_message(m2, g, null, m1,
    jsonb_build_array(jsonb_build_object('kind','image','storage_path', g || '/' || m2 || '/a.png','mime','image/png','size_bytes',10,'width',100,'height',50)));
  if jsonb_array_length(p2 -> 'attachments') <> 1 then raise exception 'attachment missing'; end if;
  if p2 -> 'reply' ->> 'body' <> 'hello' then raise exception 'reply missing %', p2; end if;
  insert into _s values ('m2', m2::text);

  -- reply_to из другого чата
  perform public.send_message(md, d, 'direct msg');
  insert into _s values ('md', md::text);
  failed := false;
  begin perform public.send_message(gen_random_uuid(), g, 'x', md); exception when sqlstate '22023' then failed := true; end;
  if not failed then raise exception 'cross-chat reply accepted'; end if;

  -- чужой id
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  failed := false;
  begin perform public.send_message(m1, g, 'steal'); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'foreign message id accepted'; end if;

  perform public.send_message(m3, g, 'from C');
  insert into _s values ('m3', m3::text);
end $$;
reset role;

do $$
declare
  g uuid := (select v::uuid from _s where k = 'g');
begin
  if (select last_message_at from public.chats where id = g) <> now() then
    raise exception 'last_message_at not updated';
  end if;
  if (select count(*) from realtime.messages where topic = 'chat:' || g and event = 'message_new') <> 3 then
    raise exception 'expected 3 message_new in group, got %',
      (select count(*) from realtime.messages where topic = 'chat:' || g and event = 'message_new');
  end if;
  if not exists (select 1 from realtime.messages
    where topic = 'chat:' || g and event = 'message_new' and private and payload -> 'sender' ->> 'display_name' = 'User A') then
    raise exception 'message_new payload missing';
  end if;
end $$;

-- ===== list_my_chats, mark_read =====
update public.chats set last_message_at = now() - interval '1 minute' where type = 'direct';
set local role authenticated;
do $$
declare
  b uuid := (select v::uuid from _s where k = 'b');
  a uuid := (select v::uuid from _s where k = 'a');
  g uuid := (select v::uuid from _s where k = 'g');
  d uuid := (select v::uuid from _s where k = 'd');
  r record;
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select * into r from public.list_my_chats() where id = g;
  if r.unread_count <> 3 then raise exception 'unread expected 3, got %', r.unread_count; end if;
  if r.last_message ->> 'sender_display_name' is null or r.role <> 'member' or r.peer is not null then
    raise exception 'bad group row %', to_jsonb(r);
  end if;

  select * into r from public.list_my_chats() where id = d;
  if r.name is not null or r.peer ->> 'id' <> a::text or r.peer ->> 'display_name' <> 'User A' or r.type <> 'direct' then
    raise exception 'bad direct row %', to_jsonb(r);
  end if;
  if r.unread_count <> 1 then raise exception 'direct unread expected 1, got %', r.unread_count; end if;

  if (select count(*) from public.list_my_chats()) <> 2 then raise exception 'B should have 2 chats'; end if;
  if (select id from public.list_my_chats() limit 1) <> g then raise exception 'sort order wrong'; end if;

  perform public.mark_read(g);
  select * into r from public.list_my_chats() where id = g;
  if r.unread_count <> 0 then raise exception 'unread after mark_read: %', r.unread_count; end if;

  begin perform public.mark_read((select v::uuid from _s where k = 'gp')); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'mark_read by non-member accepted'; end if;
end $$;
reset role;

-- ===== toggle_reaction =====
set local role authenticated;
do $$
declare
  b uuid := (select v::uuid from _s where k = 'b');
  a uuid := (select v::uuid from _s where k = 'a');
  x uuid := (select v::uuid from _s where k = 'x');
  m1 uuid := (select v::uuid from _s where k = 'm1');
  md uuid := (select v::uuid from _s where k = 'md');
  res jsonb;
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  res := public.toggle_reaction(m1, '+');
  if (res -> 'reactions' -> 0 ->> 'count')::int <> 1 or res -> 'reactions' -> 0 ->> 'emoji' <> '+' then
    raise exception 'reaction not added %', res;
  end if;
  res := public.toggle_reaction(m1, '+');
  if jsonb_array_length(res -> 'reactions') <> 0 then raise exception 'reaction not removed %', res; end if;
  res := public.toggle_reaction(m1, '+');

  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  begin perform public.toggle_reaction(m1, '+'); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'non-member reacted'; end if;
end $$;
reset role;

do $$
declare g uuid := (select v::uuid from _s where k = 'g');
begin
  if (select count(*) from realtime.messages where topic = 'chat:' || g and event = 'reaction_changed') <> 3 then
    raise exception 'expected 3 reaction_changed';
  end if;
end $$;

-- ===== delete_message =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  m1 uuid := (select v::uuid from _s where k = 'm1');
  m2 uuid := (select v::uuid from _s where k = 'm2');
  m3 uuid := (select v::uuid from _s where k = 'm3');
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin perform public.delete_message(m1); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'B deleted A message'; end if;
  failed := false;
  begin perform public.delete_message(gen_random_uuid()); exception when sqlstate 'P0002' then failed := true; end;
  if not failed then raise exception 'missing message accepted'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.delete_message(m2);   -- своё, с вложением
  perform public.delete_message(m2);   -- повтор без эффекта
  perform public.delete_message(m3);   -- admin удаляет чужое
  perform public.delete_message(m1);   -- с реакцией
end $$;
reset role;

do $$
declare
  g uuid := (select v::uuid from _s where k = 'g');
  m2 uuid := (select v::uuid from _s where k = 'm2');
  m1 uuid := (select v::uuid from _s where k = 'm1');
begin
  if exists (select 1 from public.messages where id in (m1, m2, (select v::uuid from _s where k = 'm3'))
             and (body is not null or deleted_at is null)) then
    raise exception 'messages not soft-deleted';
  end if;
  if exists (select 1 from public.attachments where message_id = m2) then raise exception 'attachments remain'; end if;
  if exists (select 1 from public.reactions where message_id = m1) then raise exception 'reactions remain'; end if;
  if (select count(*) from realtime.messages where topic = 'chat:' || g and event = 'message_deleted') <> 3 then
    raise exception 'expected 3 message_deleted (got %)',
      (select count(*) from realtime.messages where topic = 'chat:' || g and event = 'message_deleted');
  end if;
end $$;

-- ===== search_public_groups =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  x uuid := (select v::uuid from _s where k = 'x');
  g uuid := (select v::uuid from _s where k = 'g');
  gp uuid := (select v::uuid from _s where k = 'gp');
  c uuid := (select v::uuid from _s where k = 'c');
  r record;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select * into r from public.search_public_groups('ALGORITH') where id = g;
  if not found then raise exception 'group not found by partial name'; end if;
  if r.member_count <> 3 or not r.is_member then raise exception 'bad member info %', to_jsonb(r); end if;
  if exists (select 1 from public.search_public_groups('algorithms') where id = gp) then
    raise exception 'private group found';
  end if;
  if exists (select 1 from public.search_public_groups('') where id = gp) then
    raise exception 'private group in empty search';
  end if;
  if not exists (select 1 from public.search_public_groups('   ') where id = g) then
    raise exception 'empty search misses group';
  end if;
  if exists (select 1 from public.search_public_groups('100%')) then raise exception 'wildcard not escaped'; end if;
  if (select count(*) from public.search_public_groups('', 0)) > 1 then raise exception 'limit not clamped to 1'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.create_group('Other group');
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select * into r from public.search_public_groups('Other');
  if r.is_member then raise exception 'is_member wrong for non-member'; end if;
end $$;
reset role;

-- ===== realtime-политика =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  x uuid := (select v::uuid from _s where k = 'x');
  g uuid := (select v::uuid from _s where k = 'g');
  n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('realtime.topic', 'chat:' || g, true);
  select count(*) into n from realtime.messages where topic = 'chat:' || g;
  if n = 0 then raise exception 'member sees no realtime messages'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select count(*) into n from realtime.messages where topic = 'chat:' || g;
  if n <> 0 then raise exception 'non-member sees % realtime messages', n; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('realtime.topic', 'chat:garbage', true);
  select count(*) into n from realtime.messages;
  if n <> 0 then raise exception 'garbage topic returned rows'; end if;
  perform set_config('realtime.topic', 'chat:zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz', true);
  select count(*) into n from realtime.messages;
  if n <> 0 then raise exception 'invalid uuid topic returned rows'; end if;
end $$;
reset role;

-- ===== anon =====
set local role anon;
do $$
declare failed boolean := false;
begin
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.send_message(gen_random_uuid(), gen_random_uuid(), 'x');
  exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'anon can call send_message'; end if;
  failed := false;
  begin perform public.list_my_chats(); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'anon can call list_my_chats'; end if;
end $$;
reset role;

-- authenticated не вызывает внутренние функции
set local role authenticated;
do $$
declare failed boolean := false;
begin
  begin perform public.message_payload(gen_random_uuid()); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'authenticated can call message_payload'; end if;
end $$;
reset role;

rollback;
