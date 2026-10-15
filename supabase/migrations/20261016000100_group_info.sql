-- Этап 4.7: экран «О группе».

-- 1. get_group_by_code: добавлен is_public (для подписи «Приватная группа» на /join/<code>).
-- Тип результата меняется, поэтому функция пересоздаётся; права и поведение прежние.

drop function public.get_group_by_code(text);

create function public.get_group_by_code(p_code text)
returns table (
  id uuid,
  name text,
  description text,
  avatar_url text,
  member_count bigint,
  is_member boolean,
  is_public boolean
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
    ),
    c.is_public
  from public.chats c
  where c.type = 'group' and c.invite_code = btrim(coalesce(p_code, ''));
end $$;

revoke execute on function public.get_group_by_code(text) from public, anon;
grant execute on function public.get_group_by_code(text) to authenticated;

-- 2. Инвариант: в группе, где остались участники, всегда есть admin.
-- Проверка срабатывает после смены роли и после удаления участника (срабатывает в конце оператора,
-- поэтому видит итоговое состояние). Ошибка 55000. Не мешает:
--  - leave_chat: он сначала повышает преемника, потом удаляет себя;
--  - удалению самой группы (каскад) и удалению профиля (каскад): там строки chats/profiles уже удалены.

create function public.ensure_group_has_admin() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.chats c where c.id = old.chat_id and c.type = 'group') then
    return null;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.profiles p where p.id = old.user_id) then
    return null;
  end if;
  if exists (select 1 from public.chat_members cm where cm.chat_id = old.chat_id)
     and not exists (select 1 from public.chat_members cm where cm.chat_id = old.chat_id and cm.role = 'admin') then
    raise exception 'group must keep an admin' using errcode = '55000';
  end if;
  return null;
end $$;

revoke execute on function public.ensure_group_has_admin() from public, anon, authenticated;

create trigger chat_members_keep_admin_upd
  after update of role on public.chat_members
  for each row when (old.role = 'admin' and new.role <> 'admin')
  execute function public.ensure_group_has_admin();

create trigger chat_members_keep_admin_del
  after delete on public.chat_members
  for each row when (old.role = 'admin')
  execute function public.ensure_group_has_admin();
