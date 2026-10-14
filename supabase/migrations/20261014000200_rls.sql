-- Этап 1.2: вспомогательные функции, гранты и политики RLS.

create function public.is_chat_member(chat uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chat and cm.user_id = (select auth.uid())
  )
$$;

create function public.is_chat_admin(chat uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chat and cm.user_id = (select auth.uid()) and cm.role = 'admin'
  )
$$;

revoke execute on function public.is_chat_member(uuid), public.is_chat_admin(uuid) from public, anon;
grant execute on function public.is_chat_member(uuid), public.is_chat_admin(uuid) to authenticated;

-- Гранты: сначала снимаем всё, затем выдаём минимально нужное.
revoke all on public.profiles, public.chats, public.chat_members, public.messages,
  public.attachments, public.reactions, public.direct_pairs from authenticated;

grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, course, major, locale) on public.profiles to authenticated;

grant select, delete on public.chats to authenticated;
grant update (name, description, avatar_url, is_public) on public.chats to authenticated;

grant select, insert, delete on public.chat_members to authenticated;
grant update (role) on public.chat_members to authenticated;

grant select on public.messages, public.attachments, public.reactions, public.direct_pairs to authenticated;

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- chats
create policy chats_select on public.chats
  for select to authenticated
  using ((type = 'group' and is_public) or public.is_chat_member(id));

create policy chats_update on public.chats
  for update to authenticated
  using (type = 'group' and public.is_chat_admin(id))
  with check (type = 'group' and public.is_chat_admin(id));

create policy chats_delete on public.chats
  for delete to authenticated
  using (type = 'group' and public.is_chat_admin(id));

-- chat_members
create policy chat_members_select on public.chat_members
  for select to authenticated
  using (public.is_chat_member(chat_id));

create policy chat_members_insert on public.chat_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'member'
    and exists (
      select 1 from public.chats c
      where c.id = chat_id and c.type = 'group' and c.is_public
    )
  );

create policy chat_members_update on public.chat_members
  for update to authenticated
  using (public.is_chat_admin(chat_id))
  with check (public.is_chat_admin(chat_id) and user_id <> (select auth.uid()));

create policy chat_members_delete on public.chat_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_chat_admin(chat_id));

-- messages, attachments, reactions
create policy messages_select on public.messages
  for select to authenticated
  using (public.is_chat_member(chat_id));

create policy attachments_select on public.attachments
  for select to authenticated
  using (public.is_chat_member(chat_id));

create policy reactions_select on public.reactions
  for select to authenticated
  using (public.is_chat_member(chat_id));

-- direct_pairs
create policy direct_pairs_select on public.direct_pairs
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
