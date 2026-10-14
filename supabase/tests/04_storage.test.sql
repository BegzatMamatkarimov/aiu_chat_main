begin;

create temp table _s (k text primary key, v text);
grant all on _s to authenticated, anon;

insert into _s select k, gen_random_uuid()::text from unnest(array['a','b','c','msg']) k;
insert into auth.users (id, email, raw_user_meta_data)
select v::uuid, k || '@x.kz', json_build_object('full_name', 'User ' || upper(k))::jsonb
from _s where k in ('a','b','c');

-- ===== A создаёт группу, B вступает =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  g public.chats;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  g := public.create_group('Storage Group', null, true);
  insert into _s values ('g', g.id::text);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.join_chat_by_code(g.invite_code);
end $$;
reset role;

-- ===== chat-media: B (участник) =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  g text := (select v from _s where k = 'g');
  m text := (select v from _s where k = 'msg');
  failed boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  insert into storage.objects (bucket_id, name, owner, owner_id)
  values ('chat-media', g || '/' || m || '/photo.jpg', b, b::text);
  if (select count(*) from storage.objects where name = g || '/' || m || '/photo.jpg') <> 1 then
    raise exception 'B cannot read own object';
  end if;

  -- чужой owner_id
  failed := false;
  begin
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values ('chat-media', g || '/' || m || '/spoof.jpg', a, a::text);
  exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'foreign owner_id accepted'; end if;

  -- не uuid во втором сегменте
  failed := false;
  begin
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values ('chat-media', g || '/not-a-uuid/x.jpg', b, b::text);
  exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'non-uuid message folder accepted'; end if;

  -- мусор в первом сегменте: именно RLS-отказ, не ошибка приведения
  failed := false;
  begin
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values ('chat-media', 'garbage/' || m || '/x.jpg', b, b::text);
  exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'garbage chat folder accepted or wrong error'; end if;
end $$;
reset role;

-- ===== chat-media: C (не участник) =====
set local role authenticated;
do $$
declare
  b uuid := (select v::uuid from _s where k = 'b');
  c uuid := (select v::uuid from _s where k = 'c');
  g text := (select v from _s where k = 'g');
  m text := (select v from _s where k = 'msg');
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);

  if exists (select 1 from storage.objects where bucket_id = 'chat-media') then
    raise exception 'C sees chat-media object';
  end if;

  begin
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values ('chat-media', g || '/' || m || '/c.jpg', c, c::text);
  exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'C inserted into foreign chat'; end if;

  -- удаление чужого объекта: 0 строк, проверка ниже
  delete from storage.objects where bucket_id = 'chat-media';
end $$;
reset role;

do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'chat-media') <> 1 then
    raise exception 'C deleted or changed B object (count=%)',
      (select count(*) from storage.objects where bucket_id = 'chat-media');
  end if;
end $$;

-- B удаляет свой объект
set local role authenticated;
do $$
declare
  b uuid := (select v::uuid from _s where k = 'b');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  delete from storage.objects where bucket_id = 'chat-media';
end $$;
reset role;

do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'chat-media') then
    raise exception 'B could not delete own object';
  end if;
end $$;

-- ===== avatars =====
set local role authenticated;
do $$
declare
  a uuid := (select v::uuid from _s where k = 'a');
  b uuid := (select v::uuid from _s where k = 'b');
  failed boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  insert into storage.objects (bucket_id, name, owner, owner_id)
  values ('avatars', a::text || '/a.png', a, a::text);

  begin
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values ('avatars', b::text || '/a.png', a, a::text);
  exception when sqlstate '42501' then failed := true; end;
  if not failed then raise exception 'A inserted into B avatar folder'; end if;
end $$;
reset role;

-- ===== seed =====
do $$
begin
  if (select count(*) from public.chats
      where type = 'group' and is_public and created_by is null
        and invite_code in ('algo-ds','python','databases','calculus','english','aiu-general')) <> 6 then
    raise exception 'seed: expected 6 public groups';
  end if;
  if (select count(*) from public.chats) <> 7 then
    raise exception 'seed: unexpected chats count %', (select count(*) from public.chats);
  end if;
end $$;

set local role authenticated;
do $$
declare
  c uuid := (select v::uuid from _s where k = 'c');
  id1 uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  id1 := public.join_chat_by_code('algo-ds');
  if id1 is null or not public.is_chat_member(id1) then raise exception 'join algo-ds failed'; end if;
  if not exists (select 1 from public.search_public_groups('алгоритм') s where s.id = id1) then
    raise exception 'search did not find algo group';
  end if;
end $$;
reset role;

rollback;
