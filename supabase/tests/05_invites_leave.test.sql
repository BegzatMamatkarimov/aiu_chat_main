begin;

create temp table _s (k text primary key, v text);
grant all on _s to authenticated, anon;

insert into _s select k, gen_random_uuid()::text from unnest(array['a','b','c','d','e','f','outsider']) k;
insert into auth.users (id, email, raw_user_meta_data)
select v::uuid, k || '@x.kz', json_build_object('full_name', 'User ' || upper(k))::jsonb
from _s where k <> 'outsider';

-- Данные: группа G (публичная; a admin, b и c участники), закрытая группа P (a admin), direct a-b.
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  c uuid := (select v::uuid from _s where k = 'c');
  g uuid; p uuid; d uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g := (public.create_group('Algorithms', 'About algos', true)).id;
  p := (public.create_group('Closed', 'Hidden one', false)).id;
  d := public.get_or_create_direct_chat(b);
  reset role;
  insert into _s values ('g', g::text), ('p', p::text), ('dchat', d::text),
    ('gcode', (select invite_code from public.chats where id = g)),
    ('pcode', (select invite_code from public.chats where id = p));
  insert into public.chat_members (chat_id, user_id, role) values (g, b, 'member'), (g, c, 'member');
  -- детерминированный порядок вступления: b раньше c
  update public.chat_members set joined_at = now() - interval '2 days' where chat_id = g and user_id = b;
  update public.chat_members set joined_at = now() - interval '1 day' where chat_id = g and user_id = c;
end $$;

-- ===== get_group_by_code =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  g uuid := (select v::uuid from _s where k = 'g');
  p uuid := (select v::uuid from _s where k = 'p');
  r record;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select * into r from public.get_group_by_code((select v from _s where k = 'gcode'));
  if r.id is distinct from g or r.name <> 'Algorithms' or r.description <> 'About algos'
     or r.member_count <> 3 or r.is_member is not true then
    raise exception 'public preview wrong: %', r;
  end if;

  select * into r from public.get_group_by_code('  ' || (select v from _s where k = 'pcode') || ' ');
  if r.id is distinct from p or r.member_count <> 1 or r.is_member is not true then
    raise exception 'private preview wrong: %', r;
  end if;

  if (select count(*) from public.get_group_by_code('no-such-code')) <> 0 then
    raise exception 'bad code returned rows';
  end if;
  if (select count(*) from public.get_group_by_code(null)) <> 0 then
    raise exception 'null code returned rows';
  end if;
  if exists (select 1 from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
             where n.nspname = 'public' and pr.proname = 'get_group_by_code'
               and 'invite_code' = any (pr.proargnames)) then
    raise exception 'invite_code is exposed';
  end if;

  -- не участник: превью закрытой группы доступно по коду, is_member = false
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select * into r from public.get_group_by_code((select v from _s where k = 'pcode'));
  if r.id is distinct from p or r.is_member is not false then
    raise exception 'outsider preview wrong: %', r;
  end if;
end $$;
reset role;

-- ===== leave_chat: обычный участник =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  c uuid := (select v::uuid from _s where k = 'c');
  g uuid := (select v::uuid from _s where k = 'g');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.leave_chat(g);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  if (select count(*) from public.chat_members where chat_id = g) <> 2 then
    raise exception 'member did not leave';
  end if;
  if (select role from public.chat_members where chat_id = g and user_id = a) <> 'admin' then
    raise exception 'admin changed';
  end if;
  -- повторный выход: уже не участник
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  begin perform public.leave_chat(g); raise exception 'second leave accepted';
  exception when sqlstate '42501' then null; end;
end $$;
reset role;

-- вернуть c (позже b, чем были): joined_at c = now()
insert into public.chat_members (chat_id, user_id, role)
select v::uuid, (select v::uuid from _s where k = 'c'), 'member' from _s where k = 'g';

-- ===== leave_chat: последний admin, передача самому раннему (b раньше c) =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  c uuid := (select v::uuid from _s where k = 'c');
  g uuid := (select v::uuid from _s where k = 'g');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.leave_chat(g);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.chat_members where chat_id = g and user_id = a) then
    raise exception 'admin still member';
  end if;
  if (select role from public.chat_members where chat_id = g and user_id = b) <> 'admin' then
    raise exception 'earliest member did not become admin';
  end if;
  if (select role from public.chat_members where chat_id = g and user_id = c) <> 'member' then
    raise exception 'wrong member promoted';
  end if;
end $$;
reset role;

-- ===== leave_chat: admin при наличии второго admin — передачи нет =====
update public.chat_members set role = 'admin'
where chat_id = (select v::uuid from _s where k = 'g') and user_id = (select v::uuid from _s where k = 'c');
insert into public.chat_members (chat_id, user_id, role, joined_at)
select v::uuid, (select v::uuid from _s where k = 'd'), 'member', now() - interval '10 days' from _s where k = 'g';

set local role authenticated;
do $$
declare
  b uuid := (select v::uuid from _s where k = 'b');
  c uuid := (select v::uuid from _s where k = 'c');
  d uuid := (select v::uuid from _s where k = 'd');
  g uuid := (select v::uuid from _s where k = 'g');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.leave_chat(g);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  if (select role from public.chat_members where chat_id = g and user_id = d) <> 'member' then
    raise exception 'member promoted although another admin exists';
  end if;
  if (select role from public.chat_members where chat_id = g and user_id = c) <> 'admin' then
    raise exception 'remaining admin changed';
  end if;
end $$;
reset role;

-- ===== leave_chat: последний участник, группа остаётся =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  p uuid := (select v::uuid from _s where k = 'p');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.leave_chat(p);
end $$;
reset role;
do $$
declare p uuid := (select v::uuid from _s where k = 'p');
begin
  if not exists (select 1 from public.chats where id = p) then raise exception 'empty group deleted'; end if;
  if exists (select 1 from public.chat_members where chat_id = p) then raise exception 'members left in group'; end if;
end $$;

-- ===== ошибки =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  g uuid := (select v::uuid from _s where k = 'g');
  d uuid := (select v::uuid from _s where k = 'd');
  dm uuid := (select v::uuid from _s where k = 'd');
  direct_id uuid := (select v::uuid from _s where k = 'd');
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  -- a уже вышла из G: не участник
  begin perform public.leave_chat(g); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'non-member leave accepted'; end if;
  failed := false;
  begin perform public.leave_chat(gen_random_uuid()); exception when sqlstate 'P0002' then failed := true; end;
  if not failed then raise exception 'unknown chat accepted'; end if;
  failed := false;
  begin perform public.leave_chat(null); exception when sqlstate 'P0002' then failed := true; end;
  if not failed then raise exception 'null chat accepted'; end if;
end $$;
reset role;

-- direct: ошибка 22023, участие не меняется
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  dc uuid;
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select chat_id into dc from public.chat_members cm join public.chats c on c.id = cm.chat_id
  where cm.user_id = a and c.type = 'direct';
  begin perform public.leave_chat(dc); exception when sqlstate '22023' then failed := true; end;
  if not failed then raise exception 'direct leave accepted'; end if;
  if not exists (select 1 from public.chat_members where chat_id = dc and user_id = a) then
    raise exception 'direct membership removed';
  end if;
end $$;
reset role;

-- ===== anon =====
set local role anon;
do $$
declare failed boolean := false;
begin
  perform set_config('request.jwt.claims', '', true);
  begin perform public.get_group_by_code('x'); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'anon can call get_group_by_code'; end if;
  failed := false;
  begin perform public.leave_chat(gen_random_uuid()); exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'anon can call leave_chat'; end if;
end $$;
reset role;

rollback;
