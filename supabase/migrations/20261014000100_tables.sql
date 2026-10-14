-- Этап 1.1: расширения, таблицы, индексы, триггер профиля. Политики RLS и гранты — в следующей миграции.

create extension if not exists pg_trgm with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text check (username ~ '^[a-z0-9_]{3,32}$'),
  display_name text not null default '' check (char_length(display_name) <= 64),
  avatar_url text,
  course smallint check (course between 1 and 6),
  major text check (char_length(major) <= 100),
  locale text not null default 'ru' check (locale in ('kk', 'ru', 'en')),
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_key on public.profiles (lower(username));

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('group', 'direct')),
  name text,
  description text check (char_length(description) <= 500),
  avatar_url text,
  is_public boolean not null default true,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint chats_group_name_check check (type <> 'group' or (name is not null and char_length(name) between 1 and 100)),
  constraint chats_direct_not_public check (type <> 'direct' or is_public = false)
);
create index chats_name_trgm_idx on public.chats using gin (name extensions.gin_trgm_ops)
  where type = 'group' and is_public;
create index chats_last_message_at_idx on public.chats (last_message_at desc);

create table public.chat_members (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index chat_members_user_id_idx on public.chat_members (user_id);

create table public.messages (
  id uuid primary key,
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text check (char_length(body) <= 4000),
  reply_to uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index messages_chat_created_idx on public.messages (chat_id, created_at desc, id desc);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio', 'file')),
  storage_path text not null unique,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  width int,
  height int,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index attachments_message_id_idx on public.attachments (message_id);

create table public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.direct_pairs (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  chat_id uuid not null unique references public.chats (id) on delete cascade,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.reactions enable row level security;
alter table public.direct_pairs enable row level security;

revoke all on public.profiles, public.chats, public.chat_members, public.messages,
  public.attachments, public.reactions, public.direct_pairs from anon;

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ), 64),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
