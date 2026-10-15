-- Этап 4.6: превью группы по коду приглашения и выход из группы.

-- 1. get_group_by_code: превью для страницы /join/<code>. Работает и для непубличных групп:
-- код приглашения и есть доступ. Сам код в ответ не попадает. Не найдено — пустой результат.

create function public.get_group_by_code(p_code text)
returns table (
  id uuid,
  name text,
  description text,
  avatar_url text,
  member_count bigint,
  is_member boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  return query
  select
    c.id, c.name, c.description, c.avatar_url,
    (select count(*) from public.chat_members cm where cm.chat_id = c.id),
    exists (
      select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = uid
    )
  from public.chats c
  where c.type = 'group' and c.invite_code = btrim(coalesce(p_code, ''));
end $$;

revoke execute on function public.get_group_by_code(text) from public, anon;
grant execute on function public.get_group_by_code(text) to authenticated;

-- 2. leave_chat: выход из группы. Если уходит последний admin, а участники остаются,
-- права admin получает участник с самым ранним joined_at (при равенстве — меньший user_id).
-- Строки участников блокируются, чтобы два admin не ушли одновременно без передачи.
-- Пустая группа остаётся.

create function public.leave_chat(p_chat_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_type text;
  v_role text;
  v_next uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select c.type into v_type from public.chats c where c.id = p_chat_id;
  if not found then
    raise exception 'chat not found' using errcode = 'P0002';
  end if;
  if v_type <> 'group' then
    raise exception 'only groups can be left' using errcode = '22023';
  end if;

  perform cm.user_id from public.chat_members cm
  where cm.chat_id = p_chat_id
  order by cm.user_id
  for update;

  select cm.role into v_role
  from public.chat_members cm
  where cm.chat_id = p_chat_id and cm.user_id = uid;
  if not found then
    raise exception 'not a chat member' using errcode = '42501';
  end if;

  if v_role = 'admin' and not exists (
    select 1 from public.chat_members cm
    where cm.chat_id = p_chat_id and cm.role = 'admin' and cm.user_id <> uid
  ) then
    select cm.user_id into v_next
    from public.chat_members cm
    where cm.chat_id = p_chat_id and cm.user_id <> uid
    order by cm.joined_at, cm.user_id
    limit 1;

    if found then
      update public.chat_members cm set role = 'admin'
      where cm.chat_id = p_chat_id and cm.user_id = v_next;
    end if;
  end if;

  delete from public.chat_members cm
  where cm.chat_id = p_chat_id and cm.user_id = uid;
end $$;

revoke execute on function public.leave_chat(uuid) from public, anon;
grant execute on function public.leave_chat(uuid) to authenticated;
