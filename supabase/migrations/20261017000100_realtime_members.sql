-- Этап 5.3: клиент узнаёт через postgres_changes, что его добавили в чат (личный чат, вступление с другого устройства).
-- Строки видны по RLS chat_members_select. Миграция идемпотентна.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_members'
     ) then
    alter publication supabase_realtime add table public.chat_members;
  end if;
end $$;
