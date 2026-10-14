-- Этап 1.3: RPC-функции, формирование realtime-payload и политика приёма broadcast.

-- Внутренние помощники (без grant для authenticated)

create function public.reactions_payload(p_message_id uuid) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('emoji', r.emoji, 'count', r.cnt, 'user_ids', r.uids) order by r.emoji
  ), '[]'::jsonb)
  from (
    select re.emoji, count(*) as cnt, jsonb_agg(re.user_id order by re.created_at, re.user_id) as uids
    from public.reactions re
    where re.message_id = p_message_id
    group by re.emoji
  ) r
$$;

revoke execute on function public.reactions_payload(uuid) from public, anon, authenticated;

create function public.message_payload(p_message_id uuid) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'chat_id', m.chat_id,
    'body', m.body,
    'reply_to', m.reply_to,
    'created_at', m.created_at,
    'deleted_at', m.deleted_at,
    'sender', (
      select jsonb_build_object(
        'id', p.id, 'username', p.username, 'display_name', p.display_name,
        'avatar_url', p.avatar_url, 'course', p.course)
      from public.profiles p where p.id = m.sender_id
    ),
    'reply', (
      select jsonb_build_object(
        'id', r.id, 'body', r.body, 'sender_display_name', rp.display_name, 'deleted_at', r.deleted_at)
      from public.messages r
      left join public.profiles rp on rp.id = r.sender_id
      where r.id = m.reply_to
    ),
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'storage_path', a.storage_path, 'mime', a.mime,
        'size_bytes', a.size_bytes, 'width', a.width, 'height', a.height,
        'duration_ms', a.duration_ms) order by a.created_at, a.id)
      from public.attachments a where a.message_id = m.id
    ), '[]'::jsonb),
    'reactions', public.reactions_payload(m.id)
  )
  from public.messages m
  where m.id = p_message_id
$$;

revoke execute on function public.message_payload(uuid) from public, anon, authenticated;

-- 1. create_group

create function public.create_group(
  p_name text,
  p_description text default null,
  p_is_public boolean default true
) returns public.chats
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_chat public.chats;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'invalid group name' using errcode = '22023';
  end if;

  insert into public.chats (type, name, description, is_public, created_by)
  values ('group', v_name, p_description, coalesce(p_is_public, true), uid)
  returning * into v_chat;

  insert into public.chat_members (chat_id, user_id, role) values (v_chat.id, uid, 'admin');

  return v_chat;
end $$;

revoke execute on function public.create_group(text, text, boolean) from public, anon;
grant execute on function public.create_group(text, text, boolean) to authenticated;

-- 2. join_chat_by_code

create function public.join_chat_by_code(p_code text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_chat_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select c.id into v_chat_id
  from public.chats c
  where c.invite_code = btrim(coalesce(p_code, '')) and c.type = 'group';
  if v_chat_id is null then
    raise exception 'chat not found' using errcode = 'P0002';
  end if;

  insert into public.chat_members (chat_id, user_id, role)
  values (v_chat_id, uid, 'member')
  on conflict do nothing;

  return v_chat_id;
end $$;

revoke execute on function public.join_chat_by_code(text) from public, anon;
grant execute on function public.join_chat_by_code(text) to authenticated;

-- 3. get_or_create_direct_chat

create function public.get_or_create_direct_chat(p_other uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_a uuid;
  v_b uuid;
  v_chat_id uuid;
  v_inserted int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_other is null or p_other = uid then
    raise exception 'invalid peer' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_other) then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  v_a := least(uid, p_other);
  v_b := greatest(uid, p_other);

  select dp.chat_id into v_chat_id
  from public.direct_pairs dp
  where dp.user_a = v_a and dp.user_b = v_b;

  if v_chat_id is null then
    insert into public.chats (type, is_public, created_by)
    values ('direct', false, uid)
    returning id into v_chat_id;

    insert into public.direct_pairs (user_a, user_b, chat_id)
    values (v_a, v_b, v_chat_id)
    on conflict (user_a, user_b) do nothing;
    get diagnostics v_inserted = row_count;

    if v_inserted = 0 then
      delete from public.chats where id = v_chat_id;
      select dp.chat_id into v_chat_id
      from public.direct_pairs dp
      where dp.user_a = v_a and dp.user_b = v_b;
    end if;
  end if;

  insert into public.chat_members (chat_id, user_id, role)
  values (v_chat_id, uid, 'member'), (v_chat_id, p_other, 'member')
  on conflict do nothing;

  return v_chat_id;
end $$;

revoke execute on function public.get_or_create_direct_chat(uuid) from public, anon;
grant execute on function public.get_or_create_direct_chat(uuid) to authenticated;

-- 4. send_message

create function public.send_message(
  p_id uuid,
  p_chat_id uuid,
  p_body text default null,
  p_reply_to uuid default null,
  p_attachments jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_existing public.messages;
  v_body text;
  v_atts jsonb := coalesce(p_attachments, '[]'::jsonb);
  v_prefix text;
  v_att jsonb;
  v_path text;
  v_created timestamptz;
  v_payload jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_id is null or p_chat_id is null then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;
  if not public.is_chat_member(p_chat_id) then
    raise exception 'not a chat member' using errcode = '42501';
  end if;

  select * into v_existing from public.messages m where m.id = p_id;
  if found then
    if v_existing.sender_id = uid and v_existing.chat_id = p_chat_id then
      return public.message_payload(p_id);
    end if;
    raise exception 'message id is taken' using errcode = '42501';
  end if;

  if jsonb_typeof(v_atts) <> 'array' then
    raise exception 'attachments must be an array' using errcode = '22023';
  end if;
  v_body := nullif(btrim(coalesce(p_body, '')), '');
  if v_body is null and jsonb_array_length(v_atts) = 0 then
    raise exception 'empty message' using errcode = '22023';
  end if;
  if jsonb_array_length(v_atts) > 10 then
    raise exception 'too many attachments' using errcode = '22023';
  end if;

  if p_reply_to is not null and not exists (
    select 1 from public.messages r where r.id = p_reply_to and r.chat_id = p_chat_id
  ) then
    raise exception 'invalid reply_to' using errcode = '22023';
  end if;

  insert into public.messages (id, chat_id, sender_id, body, reply_to)
  values (p_id, p_chat_id, uid, v_body, p_reply_to)
  returning created_at into v_created;

  v_prefix := p_chat_id::text || '/' || p_id::text || '/';
  for v_att in select e from jsonb_array_elements(v_atts) e loop
    if jsonb_typeof(v_att) <> 'object' then
      raise exception 'invalid attachment' using errcode = '22023';
    end if;
    v_path := v_att ->> 'storage_path';
    if v_path is null
       or left(v_path, char_length(v_prefix)) <> v_prefix
       or position('..' in v_path) > 0 then
      raise exception 'invalid storage_path' using errcode = '22023';
    end if;
    insert into public.attachments
      (message_id, chat_id, kind, storage_path, mime, size_bytes, width, height, duration_ms)
    values (
      p_id, p_chat_id, v_att ->> 'kind', v_path, v_att ->> 'mime',
      (v_att ->> 'size_bytes')::bigint, (v_att ->> 'width')::int,
      (v_att ->> 'height')::int, (v_att ->> 'duration_ms')::int
    );
  end loop;

  update public.chats set last_message_at = v_created where id = p_chat_id;

  v_payload := public.message_payload(p_id);
  perform realtime.send(v_payload, 'message_new', 'chat:' || p_chat_id::text, true);
  return v_payload;
end $$;

revoke execute on function public.send_message(uuid, uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.send_message(uuid, uuid, text, uuid, jsonb) to authenticated;

-- 5. delete_message

create function public.delete_message(p_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_msg public.messages;
  v_type text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_msg from public.messages m where m.id = p_id;
  if not found then
    raise exception 'message not found' using errcode = 'P0002';
  end if;

  select c.type into v_type from public.chats c where c.id = v_msg.chat_id;
  if not (
    v_msg.sender_id = uid
    or (v_type = 'group' and public.is_chat_admin(v_msg.chat_id))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_msg.deleted_at is not null then
    return;
  end if;

  update public.messages set deleted_at = now(), body = null where id = p_id;
  delete from public.attachments where message_id = p_id;
  delete from public.reactions where message_id = p_id;

  perform realtime.send(
    jsonb_build_object('id', p_id, 'chat_id', v_msg.chat_id),
    'message_deleted', 'chat:' || v_msg.chat_id::text, true);
end $$;

revoke execute on function public.delete_message(uuid) from public, anon;
grant execute on function public.delete_message(uuid) to authenticated;

-- 6. toggle_reaction

create function public.toggle_reaction(p_message_id uuid, p_emoji text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_msg public.messages;
  v_deleted int;
  v_result jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_msg from public.messages m where m.id = p_message_id;
  if not found then
    raise exception 'message not found' using errcode = 'P0002';
  end if;
  if not public.is_chat_member(v_msg.chat_id) then
    raise exception 'not a chat member' using errcode = '42501';
  end if;
  if v_msg.deleted_at is not null then
    raise exception 'message deleted' using errcode = '22023';
  end if;

  delete from public.reactions r
  where r.message_id = p_message_id and r.user_id = uid and r.emoji = p_emoji;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    insert into public.reactions (message_id, chat_id, user_id, emoji)
    values (p_message_id, v_msg.chat_id, uid, p_emoji);
  end if;

  v_result := jsonb_build_object(
    'message_id', p_message_id,
    'chat_id', v_msg.chat_id,
    'reactions', public.reactions_payload(p_message_id));
  perform realtime.send(v_result, 'reaction_changed', 'chat:' || v_msg.chat_id::text, true);
  return v_result;
end $$;

revoke execute on function public.toggle_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_reaction(uuid, text) to authenticated;

-- 7. mark_read

create function public.mark_read(p_chat_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_updated int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.chat_members cm set last_read_at = now()
  where cm.chat_id = p_chat_id and cm.user_id = uid;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'not a chat member' using errcode = '42501';
  end if;
end $$;

revoke execute on function public.mark_read(uuid) from public, anon;
grant execute on function public.mark_read(uuid) to authenticated;

-- 8. search_public_groups

create function public.search_public_groups(p_query text default '', p_limit int default 20)
returns table (
  id uuid,
  name text,
  description text,
  avatar_url text,
  invite_code text,
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
  v_q text := btrim(coalesce(p_query, ''));
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_like text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select g.id, g.name, g.description, g.avatar_url, g.invite_code, g.member_count, g.is_member
  from (
    select
      c.id, c.name, c.description, c.avatar_url, c.invite_code,
      (select count(*) from public.chat_members cm where cm.chat_id = c.id) as member_count,
      exists (
        select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = uid
      ) as is_member,
      case when v_q = '' then 0::real else extensions.similarity(c.name, v_q) end as sim
    from public.chats c
    where c.type = 'group' and c.is_public
      and (v_q = '' or c.name ilike v_like or extensions.similarity(c.name, v_q) > 0.2)
  ) g
  order by g.sim desc, g.member_count desc, g.id
  limit v_limit;
end $$;

revoke execute on function public.search_public_groups(text, int) from public, anon;
grant execute on function public.search_public_groups(text, int) to authenticated;

-- 9. list_my_chats

create function public.list_my_chats()
returns table (
  id uuid,
  type text,
  name text,
  avatar_url text,
  last_message_at timestamptz,
  last_message jsonb,
  unread_count bigint,
  role text,
  peer jsonb
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
    c.id,
    c.type,
    case when c.type = 'direct' then null else c.name end,
    c.avatar_url,
    c.last_message_at,
    (
      select jsonb_build_object(
        'id', m.id,
        'body', m.body,
        'created_at', m.created_at,
        'deleted_at', m.deleted_at,
        'sender_id', m.sender_id,
        'sender_display_name', sp.display_name,
        'attachment_kind', (
          select a.kind from public.attachments a
          where a.message_id = m.id order by a.created_at, a.id limit 1
        ))
      from public.messages m
      left join public.profiles sp on sp.id = m.sender_id
      where m.chat_id = c.id
      order by m.created_at desc, m.id desc
      limit 1
    ),
    (
      select count(*) from public.messages m
      where m.chat_id = c.id
        and m.created_at > me.last_read_at
        and m.sender_id is distinct from uid
        and m.deleted_at is null
    ),
    me.role,
    case when c.type = 'direct' then (
      select jsonb_build_object(
        'id', pp.id, 'username', pp.username, 'display_name', pp.display_name,
        'avatar_url', pp.avatar_url, 'course', pp.course)
      from public.direct_pairs dp
      join public.profiles pp
        on pp.id = case when dp.user_a = uid then dp.user_b else dp.user_a end
      where dp.chat_id = c.id
    ) else null end
  from public.chat_members me
  join public.chats c on c.id = me.chat_id
  where me.user_id = uid
  order by c.last_message_at desc, c.id;
end $$;

revoke execute on function public.list_my_chats() from public, anon;
grant execute on function public.list_my_chats() to authenticated;

-- Realtime: приём broadcast только участниками чата

create function public.realtime_topic_chat_id(topic text) returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if topic ~ '^chat:[0-9a-fA-F-]{36}$' then
    return substr(topic, 6)::uuid;
  end if;
  return null;
exception when others then
  return null;
end $$;

revoke execute on function public.realtime_topic_chat_id(text) from public, anon;
grant execute on function public.realtime_topic_chat_id(text) to authenticated;

create policy chat_members_receive on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.is_chat_member(public.realtime_topic_chat_id((select realtime.topic())))
  );
