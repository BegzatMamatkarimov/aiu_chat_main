begin;

do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  p public.profiles;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (u1, 'test1@x.kz', '{"full_name":"Test User","avatar_url":"http://x/a.png"}');
  select * into p from public.profiles where id = u1;
  if p.display_name is distinct from 'Test User' or p.avatar_url is distinct from 'http://x/a.png' then
    raise exception 'profile from metadata wrong: %', p;
  end if;

  insert into auth.users (id, email) values (u2, 'plain.name@x.kz');
  select * into p from public.profiles where id = u2;
  if p.display_name is distinct from 'plain.name' or p.avatar_url is not null then
    raise exception 'profile fallback wrong: %', p;
  end if;
end $$;

do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  failed boolean;
begin
  insert into auth.users (id, email) values (u1, 'a@x.kz'), (u2, 'b@x.kz');

  failed := false;
  begin
    update public.profiles set username = 'Bad Name!' where id = u1;
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'invalid username accepted'; end if;

  update public.profiles set username = 'john_doe' where id = u1;
  failed := false;
  begin
    update public.profiles set username = 'JOHN_DOE' where id = u2;
  exception when check_violation then failed := true; when unique_violation then failed := true; end;
  if not failed then raise exception 'case-insensitive username unique not enforced'; end if;
end $$;

do $$
declare
  failed boolean;
  c1 public.chats;
  c2 public.chats;
begin
  failed := false;
  begin
    insert into public.chats (type) values ('group');
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'group without name accepted'; end if;

  failed := false;
  begin
    insert into public.chats (type, name, is_public) values ('group', '', true);
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'group with empty name accepted'; end if;

  failed := false;
  begin
    insert into public.chats (type, is_public) values ('direct', true);
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'public direct accepted'; end if;

  insert into public.chats (type, is_public) values ('direct', false);
  insert into public.chats (type, name) values ('group', 'G1') returning * into c1;
  insert into public.chats (type, name) values ('group', 'G2') returning * into c2;
  if c1.invite_code !~ '^[0-9a-f]{10}$' or c1.invite_code = c2.invite_code then
    raise exception 'invite_code bad: % %', c1.invite_code, c2.invite_code;
  end if;
end $$;

do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  lo uuid;
  hi uuid;
  ch uuid;
  failed boolean;
begin
  insert into auth.users (id, email) values (u1, 'c@x.kz'), (u2, 'd@x.kz');
  lo := least(u1, u2);
  hi := greatest(u1, u2);
  insert into public.chats (type, is_public) values ('direct', false) returning id into ch;

  failed := false;
  begin
    insert into public.direct_pairs (user_a, user_b, chat_id) values (hi, lo, ch);
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'user_a > user_b accepted'; end if;

  failed := false;
  begin
    insert into public.direct_pairs (user_a, user_b, chat_id) values (lo, lo, ch);
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'user_a = user_b accepted'; end if;

  insert into public.direct_pairs (user_a, user_b, chat_id) values (lo, hi, ch);
end $$;

do $$
declare
  u uuid := gen_random_uuid();
  ch uuid;
  m uuid := gen_random_uuid();
  failed boolean;
begin
  insert into auth.users (id, email) values (u, 'e@x.kz');
  insert into public.chats (type, name) values ('group', 'G') returning id into ch;
  insert into public.messages (id, chat_id, sender_id, body) values (m, ch, u, 'hi');

  failed := false;
  begin
    insert into public.attachments (message_id, chat_id, kind, storage_path, mime, size_bytes)
    values (m, ch, 'video', ch || '/' || m || '/big.mp4', 'video/mp4', 52428801);
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'oversized attachment accepted'; end if;

  insert into public.attachments (message_id, chat_id, kind, storage_path, mime, size_bytes)
  values (m, ch, 'video', ch || '/' || m || '/ok.mp4', 'video/mp4', 52428800);
end $$;

do $$
declare
  u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (u, 'f@x.kz');
  if not exists (select from public.profiles where id = u) then raise exception 'no profile'; end if;
  delete from auth.users where id = u;
  if exists (select from public.profiles where id = u) then raise exception 'profile not cascaded'; end if;
end $$;

rollback;
