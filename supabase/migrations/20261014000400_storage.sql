-- Storage: бакеты и политики доступа.

create function public.try_uuid(p text) returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

revoke execute on function public.try_uuid(text) from public, anon;
grant execute on function public.try_uuid(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('chat-media', 'chat-media', false, 52428800, '{image/*,video/*,audio/*}'),
  ('avatars', 'avatars', true, 5242880, '{image/*}')
on conflict (id) do nothing;

-- chat-media: путь <chat_id>/<message_id>/<file>

create policy chat_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_chat_member(public.try_uuid((storage.foldername(name))[1]))
  );

create policy chat_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_chat_member(public.try_uuid((storage.foldername(name))[1]))
    and public.try_uuid((storage.foldername(name))[2]) is not null
    and owner_id = (select auth.uid())::text
  );

create policy chat_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and owner_id = (select auth.uid())::text
  );

-- avatars: путь <user_id>/<file>

create policy avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
