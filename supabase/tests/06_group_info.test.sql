begin;

create temp table _s (k text primary key, v text);
grant all on _s to authenticated, anon;

insert into _s select k, gen_random_uuid()::text from unnest(array['a','b','c','d']) k;
insert into auth.users (id, email, raw_user_meta_data)
select v::uuid, k || '@x.kz', json_build_object('full_name', 'User ' || upper(k))::jsonb from _s;

-- Группа G (публичная): a admin; b, c, d участники. Закрытая группа P: a admin.
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  g uuid; p uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g := (public.create_group('Algorithms', 'About algos', true)).id;
  p := (public.create_group('Closed', 'Hidden one', false)).id;
  reset role;
  insert into _s values ('g', g::text), ('p', p::text),
    ('gcode', (select invite_code from public.chats where id = g)),
    ('pcode', (select invite_code from public.chats where id = p));
  insert into public.chat_members (chat_id, user_id, role)
  select g, v::uuid, 'member' from _s where k in ('b', 'c', 'd');
end $$;

-- ===== get_group_by_code: is_public =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  r record;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select * into r from public.get_group_by_code((select v from _s where k = 'gcode'));
  if r.is_public is not true or r.member_count <> 4 or r.is_member is not true then
    raise exception 'public group preview wrong: %', r;
  end if;
  select * into r from public.get_group_by_code((select v from _s where k = 'pcode'));
  if r.is_public is not false or r.is_member is not true then
    raise exception 'private group preview wrong: %', r;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select * into r from public.get_group_by_code((select v from _s where k = 'pcode'));
  if r.is_public is not false or r.is_member is not false then
    raise exception 'outsider private preview wrong: %', r;
  end if;
  if (select count(*) from public.get_group_by_code('no-such-code')) <> 0 then
    raise exception 'bad code returned rows';
  end if;
end $$;
reset role;

-- ===== admin: повышает и понижает участника, удаляет участника =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  c uuid := (select v::uuid from _s where k = 'c');
  g uuid := (select v::uuid from _s where k = 'g');
  n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.chat_members set role = 'admin' where chat_id = g and user_id = b;
  get diagnostics n = row_count;
  if n <> 1 or (select role from public.chat_members where chat_id = g and user_id = b) <> 'admin' then
    raise exception 'admin could not promote';
  end if;
  update public.chat_members set role = 'member' where chat_id = g and user_id = b;
  get diagnostics n = row_count;
  if n <> 1 or (select role from public.chat_members where chat_id = g and user_id = b) <> 'member' then
    raise exception 'admin could not demote';
  end if;
  delete from public.chat_members where chat_id = g and user_id = c;
  get diagnostics n = row_count;
  if n <> 1 or exists (select 1 from public.chat_members where chat_id = g and user_id = c) then
    raise exception 'admin could not remove member';
  end if;
end $$;
reset role;

-- ===== не admin: ни ролей, ни удаления, ни правки группы =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  d uuid := (select v::uuid from _s where k = 'd');
  g uuid := (select v::uuid from _s where k = 'g');
  n int;
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  update public.chat_members set role = 'admin' where chat_id = g and user_id = d;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'member promoted another'; end if;
  update public.chat_members set role = 'admin' where chat_id = g and user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'member promoted self'; end if;
  update public.chat_members set role = 'member' where chat_id = g and user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'member demoted admin'; end if;
  delete from public.chat_members where chat_id = g and user_id = d;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'member removed another'; end if;
  delete from public.chat_members where chat_id = g and user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'member removed admin'; end if;
  update public.chats set name = 'Hacked', description = 'x', is_public = false where id = g;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'member edited group'; end if;
  delete from public.chats where id = g;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'member deleted group'; end if;
end $$;
reset role;

do $$
declare g uuid := (select v::uuid from _s where k = 'g');
begin
  if (select name from public.chats where id = g) <> 'Algorithms' or (select is_public from public.chats where id = g) is not true then
    raise exception 'group changed by non-admin';
  end if;
  if (select count(*) from public.chat_members where chat_id = g) <> 3 then
    raise exception 'members changed by non-admin';
  end if;
end $$;

-- ===== инвариант: последнего admin нельзя снять или удалить, пока есть другие участники =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  g uuid := (select v::uuid from _s where k = 'g');
  failed boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  -- удалить себя напрямую (минуя leave_chat)
  failed := false;
  begin
    delete from public.chat_members where chat_id = g and user_id = a;
  exception when sqlstate '55000' then failed := true; end;
  if not failed then raise exception 'last admin removed itself'; end if;
  if (select role from public.chat_members where chat_id = g and user_id = a) <> 'admin' then
    raise exception 'admin lost';
  end if;
end $$;
reset role;

-- снять роль последнего admin напрямую (RLS не пускает себя, поэтому от имени владельца таблицы)
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  g uuid := (select v::uuid from _s where k = 'g');
  failed boolean := false;
begin
  begin
    update public.chat_members set role = 'member' where chat_id = g and user_id = a;
  exception when sqlstate '55000' then failed := true; end;
  if not failed then raise exception 'last admin demoted'; end if;
  failed := false;
  begin
    delete from public.chat_members where chat_id = g and user_id = a;
  exception when sqlstate '55000' then failed := true; end;
  if not failed then raise exception 'last admin deleted'; end if;
  -- массовое снятие ролей у обоих admin
  update public.chat_members set role = 'admin' where chat_id = g and user_id = (select v::uuid from _s where k = 'b');
  failed := false;
  begin
    update public.chat_members set role = 'member' where chat_id = g and role = 'admin';
  exception when sqlstate '55000' then failed := true; end;
  if not failed then raise exception 'all admins demoted in one statement'; end if;
  update public.chat_members set role = 'member' where chat_id = g and user_id = (select v::uuid from _s where k = 'b');
end $$;

-- второй admin есть: первого можно снять и удалить (admin b назначает себе замену)
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  g uuid := (select v::uuid from _s where k = 'g');
begin
  update public.chat_members set role = 'admin' where chat_id = g and user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.chat_members set role = 'member' where chat_id = g and user_id = a;
  if (select role from public.chat_members where chat_id = g and user_id = a) <> 'member' then
    raise exception 'second admin could not demote the first';
  end if;
  update public.chat_members set role = 'admin' where chat_id = g and user_id = a;
  delete from public.chat_members where chat_id = g and user_id = a;
  if exists (select 1 from public.chat_members where chat_id = g and user_id = a) then
    raise exception 'second admin could not remove the first';
  end if;
  reset role;
  -- вернуть a как admin, b как member
  insert into public.chat_members (chat_id, user_id, role) values (g, a, 'admin');
  update public.chat_members set role = 'member' where chat_id = g and user_id = b;
end $$;

-- ===== admin меняет тип группы и поиск реагирует =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  d uuid := (select v::uuid from _s where k = 'd');
  g uuid := (select v::uuid from _s where k = 'g');
  n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.chats set name = 'Algorithms 2', description = 'New text', is_public = false where id = g;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'admin could not edit group'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.search_public_groups('Algorithms')) then
    raise exception 'private group found in search';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.chats set is_public = true where id = g;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.search_public_groups('Algorithms') s where s.id = g and s.name = 'Algorithms 2') then
    raise exception 'public group not found in search';
  end if;
end $$;
reset role;

-- ограничения полей
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  g uuid := (select v::uuid from _s where k = 'g');
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin update public.chats set name = '' where id = g; exception when check_violation then failed := true; end;
  if not failed then raise exception 'empty name accepted'; end if;
  failed := false;
  begin update public.chats set description = repeat('x', 501) where id = g; exception when check_violation then failed := true; end;
  if not failed then raise exception 'long description accepted'; end if;
end $$;
reset role;

-- ===== leave_chat последнего admin по-прежнему работает =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  g uuid := (select v::uuid from _s where k = 'g');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.leave_chat(g);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.chat_members where chat_id = g and user_id = a) then
    raise exception 'admin did not leave';
  end if;
  if not exists (select 1 from public.chat_members where chat_id = g and role = 'admin') then
    raise exception 'no admin after leave';
  end if;
end $$;
reset role;

-- ===== удаление группы и профиля последнего admin не блокируется =====
do $$
declare
  p uuid := (select v::uuid from _s where k = 'p');
  a uuid := (select v::uuid from _s where k = 'a');
  d uuid := (select v::uuid from _s where k = 'd');
begin
  insert into public.chat_members (chat_id, user_id, role) values (p, d, 'member') on conflict do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.chats where id = p;
  reset role;
  if exists (select 1 from public.chats where id = p) then raise exception 'group not deleted'; end if;
  if exists (select 1 from public.chat_members where chat_id = p) then raise exception 'members left'; end if;
end $$;

-- удаление профиля последнего admin (каскад) не блокируется
do $$
declare
  c uuid := (select v::uuid from _s where k = 'c');
  d uuid := (select v::uuid from _s where k = 'd');
  g2 uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g2 := (public.create_group('Temp', null, true)).id;
  reset role;
  insert into public.chat_members (chat_id, user_id, role) values (g2, d, 'member');
  delete from public.profiles where id = c;
  if exists (select 1 from public.chat_members where chat_id = g2 and user_id = c) then
    raise exception 'profile delete did not cascade';
  end if;
  if not exists (select 1 from public.chat_members where chat_id = g2 and user_id = d) then
    raise exception 'other member lost';
  end if;
end $$;

rollback;
