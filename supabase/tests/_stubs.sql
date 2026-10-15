-- ТОЛЬКО ДЛЯ ЛОКАЛЬНЫХ ТЕСТОВ (scripts/db-test.sh). В Supabase НЕ применять:
-- там эти роли, схемы и функции уже существуют.

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists realtime;

grant usage on schema public, extensions, auth, storage, realtime to anon, authenticated, service_role;

-- auth
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'
);

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

create function auth.role() returns text
language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- storage
create table storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  owner_id text,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;

grant select on storage.buckets to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.objects to anon;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- realtime
create table realtime.messages (
  id bigserial,
  topic text,
  extension text,
  payload jsonb,
  event text,
  private boolean,
  inserted_at timestamptz default now()
);
alter table realtime.messages enable row level security;

create function realtime.topic() returns text
language sql stable as $$
  select current_setting('realtime.topic', true)
$$;

create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void
language plpgsql as $$
begin
  insert into realtime.messages (topic, extension, payload, event, private)
  values (topic, 'broadcast', payload, event, private);
end $$;

grant select on realtime.messages to authenticated;
grant execute on function realtime.topic() to anon, authenticated, service_role;

-- В Supabase публикация supabase_realtime создана по умолчанию (пустая).
create publication supabase_realtime;
