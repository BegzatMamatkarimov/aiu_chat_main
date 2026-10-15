-- Этап 5.3: chat_members в публикации supabase_realtime, повторное применение миграции безопасно.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_members'
  ) then
    raise exception 'chat_members is not in supabase_realtime';
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('messages', 'reactions', 'attachments')
  ) then
    raise exception 'unexpected tables in supabase_realtime';
  end if;
end $$;

\ir ../migrations/20261017000100_realtime_members.sql

do $$
begin
  if (select count(*) from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_members') <> 1 then
    raise exception 'chat_members must be in the publication exactly once';
  end if;
end $$;
