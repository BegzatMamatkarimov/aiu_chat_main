# DB: спецификация базы данных (этап 1)

Детализация раздела 5 `docs/PLAN.md`. Это источник правды для миграций в `supabase/migrations/`.

## Принципы

- Все таблицы в схеме `public`, на всех включён RLS.
- Записи, которые затрагивают несколько таблиц или должны рассылать realtime-события, идут **только через RPC-функции**. Прямого `insert` в `chats`, `messages`, `attachments`, `reactions` и `direct_pairs` у клиента нет.
- RPC объявлены как `security definer`, `set search_path = ''`, все имена пишутся с указанием схемы. `execute` выдан только роли `authenticated`.
- Realtime: RPC сами вызывают `realtime.send(payload, event, topic, private => true)` в топик `chat:<chat_id>`. Подписка на топик разрешена только участникам чата (RLS на `realtime.messages`).
- Расширения ставятся в схему `extensions`: `pg_trgm`.

## Таблицы

### profiles
| колонка | тип | правила |
|---|---|---|
| id | uuid PK | → `auth.users(id)` on delete cascade |
| username | text, null | unique по `lower(username)`; check `^[a-z0-9_]{3,32}$`; пустой до онбординга |
| display_name | text not null default '' | ≤ 64 символов |
| avatar_url | text, null | |
| course | smallint, null | check 1..6 |
| major | text, null | ≤ 100 символов |
| locale | text not null default 'ru' | check in ('kk','ru','en') |
| created_at | timestamptz not null default now() | |

Профиль создаётся триггером `after insert on auth.users`:
- `display_name` берётся из `raw_user_meta_data->>'full_name'`, если его нет — из `->>'name'`, иначе из части e-mail до `@`;
- `avatar_url` берётся из `raw_user_meta_data->>'avatar_url'`.

### chats
| колонка | тип | правила |
|---|---|---|
| id | uuid PK default gen_random_uuid() | |
| type | text not null | check in ('group','direct') |
| name | text, null | для group обязательно, 1..100 символов |
| description | text, null | ≤ 500 |
| avatar_url | text, null | |
| is_public | boolean not null default true | для direct всегда false (check) |
| invite_code | text not null unique | default: 10 hex-символов из gen_random_uuid() |
| created_by | uuid, null | → profiles on delete set null |
| created_at | timestamptz not null default now() | |
| last_message_at | timestamptz not null default now() | обновляет `send_message` |

Индексы:
- GIN trigram по `name` (`extensions.gin_trgm_ops`) с условием `where type = 'group' and is_public`;
- `last_message_at desc`.

### chat_members
PK (chat_id, user_id). Поля: chat_id → chats on delete cascade; user_id → profiles on delete cascade; role text not null default 'member' check in ('admin','member'); joined_at, last_read_at timestamptz not null default now(). Индекс по user_id.

### messages
| колонка | тип | правила |
|---|---|---|
| id | uuid PK | генерирует клиент (идемпотентная отправка) |
| chat_id | uuid not null | → chats on delete cascade |
| sender_id | uuid, null | → profiles on delete set null |
| body | text, null | ≤ 4000 символов |
| reply_to | uuid, null | → messages on delete set null |
| created_at | timestamptz not null default now() | |
| deleted_at | timestamptz, null | мягкое удаление |

Индекс (chat_id, created_at desc, id desc).

### attachments
id uuid PK default gen_random_uuid(); message_id → messages on delete cascade; chat_id → chats on delete cascade (денормализация для RLS); kind text check in ('image','video','audio','file'); storage_path text not null unique; mime text not null; size_bytes bigint not null check 0 < x ≤ 52428800; width, height int null; duration_ms int null; created_at. Индекс по message_id.

### reactions
PK (message_id, user_id, emoji). Поля: message_id → messages on delete cascade; chat_id → chats on delete cascade (денормализация); user_id → profiles on delete cascade; emoji text check длина 1..16; created_at.

### direct_pairs
PK (user_a, user_b), check user_a < user_b; chat_id unique → chats on delete cascade.

## Вспомогательные функции (security definer, stable)

- `public.is_chat_member(chat uuid) → boolean`
- `public.is_chat_admin(chat uuid) → boolean`

## RLS

| таблица | select | insert | update | delete |
|---|---|---|---|---|
| profiles | любой authenticated | — (триггер) | только своя строка (`id = auth.uid()`), без смены id | — |
| chats | `(type='group' and is_public) or is_chat_member(id)` | — (RPC) | admin группы | admin группы |
| chat_members | участник этого чата | сам себя, role='member', только в публичную группу | admin (смена ролей) | себя (выход) или admin |
| messages | участник | — (RPC) | — (RPC) | — |
| attachments | участник (по chat_id) | — (RPC) | — | — |
| reactions | участник (по chat_id) | — (RPC) | — | — |
| direct_pairs | `auth.uid() in (user_a, user_b)` | — | — | — |

Роль `anon` не получает доступа ни к одной таблице.

## RPC

| функция | что делает | проверки |
|---|---|---|
| `create_group(name, description, is_public default true) → chats` | создаёт группу и запись admin для создателя | длина name |
| `join_chat_by_code(code) → uuid` | вступление в группу по коду, в том числе в непубличную; повторный вызов ничего не ломает | только type='group' |
| `get_or_create_direct_chat(other_user uuid) → uuid` | один личный чат на пару пользователей, без гонок (on conflict по direct_pairs) | other ≠ self, other существует |
| `send_message(id, chat_id, body, reply_to, attachments jsonb) → messages` | вставляет сообщение и вложения, обновляет `chats.last_message_at`, шлёт `message_new` (полное сообщение + вложения + профиль автора); повтор с тем же id возвращает существующее сообщение | участник; есть body или вложения; reply_to из того же чата; `storage_path` каждого вложения начинается с `<chat_id>/<id>/` |
| `delete_message(id)` | ставит deleted_at, обнуляет body, удаляет строки вложений, шлёт `message_deleted` | автор или admin группы |
| `toggle_reaction(message_id, emoji)` | добавляет реакцию или снимает свою, шлёт `reaction_changed` с актуальными счётчиками по сообщению | участник |
| `mark_read(chat_id)` | last_read_at = now() для себя | участник |
| `search_public_groups(q text, lim int default 20)` | публичные группы по похожести названия + member_count + is_member | — |
| `list_my_chats()` | мои чаты: последнее сообщение (текст или тип вложения), unread_count, для direct — профиль собеседника; сортировка по last_message_at desc | — |
| `get_group_by_code(code) → table(id, name, description, avatar_url, member_count, is_member, is_public)` | превью группы для `/join/<code>` (`is_public` — для подписи «Приватная группа»); работает и для непубличных групп (код и есть доступ); `invite_code` не возвращает; неверный код — пустой результат | только type='group' |
| `leave_chat(chat_id)` | выход из группы; если уходит последний admin и участники остаются, admin становится участник с самым ранним `joined_at` (при равенстве — меньший `user_id`); строки участников блокируются; пустая группа остаётся | только type='group'; вызывающий — участник |

## Роли и состав группы (этап 4.7)

Отдельных RPC нет, всё через RLS:
- смена роли участника — `update chat_members set role` (admin; себе роль менять нельзя, `with check user_id <> auth.uid()`);
- удаление участника — `delete from chat_members` (admin);
- название, описание, тип — `update chats set name, description, is_public` (admin группы).

Триггеры `chat_members_keep_admin_upd` / `chat_members_keep_admin_del` (функция `ensure_group_has_admin`, срабатывает после оператора) хранят инвариант: если в группе остались участники, в ней есть admin. Нарушение — ошибка `55000` (`group must keep an admin`). `leave_chat` сначала повышает преемника, потом удаляет себя, поэтому не мешает. Каскадное удаление группы или профиля тоже не блокируется.

Файлы вложений из Storage на этапе 1 не удаляются. Очистку добавим позже.

## Realtime

- Топик `chat:<uuid>`, приватный.
- События: `message_new`, `message_deleted`, `reaction_changed`.
- Политика на `realtime.messages` для `authenticated` (select): `realtime.messages.extension = 'broadcast'` и `realtime.topic()` вида `chat:<uuid>`, где пользователь — участник чата. Невалидный uuid не должен вызывать ошибку, только отказ.
- Новый чат для пользователя: таблица `chat_members` добавлена в публикацию `supabase_realtime` (миграция `20261017000100_realtime_members.sql`, идемпотентная). Клиент слушает `postgres_changes` INSERT с фильтром `user_id=eq.<me>`; RLS `chat_members_select` оставляет только свои строки. Событие лишь заставляет перезагрузить `list_my_chats`, после чего клиент подписывается на `chat:<id>` нового чата. Остальные таблицы в публикацию не входят.
- Payload `reaction_changed`: `{message_id, chat_id, reactions: [{emoji, count, user_ids}]}`, поэтому клиент сам определяет «моя» реакция по `user_ids`. `message_deleted`: `{id, chat_id}`. `message_new`: `message_payload` (автор, ответ, вложения, реакции).

## Storage

| bucket | доступ | лимит | путь |
|---|---|---|---|
| `chat-media` (приватный) | читать и загружать может участник чата из первой папки пути; удалять — владелец объекта | 50 МБ; mime `image/*`, `video/*`, `audio/*` | `<chat_id>/<message_id>/<file>` |
| `avatars` (публичное чтение) | загружать и менять — только в свою папку | 5 МБ; `image/*` | `<user_id>/<file>` |

## Локальная проверка

Docker-образы Supabase здесь недоступны, поэтому тесты идут на обычном PostgreSQL 16.
- Схемы `auth`, `storage`, `realtime` подменяются заглушками из `supabase/tests/_stubs.sql`:
  - `auth.users`, `auth.uid()` (берёт `sub` из `request.jwt.claims`);
  - `storage.buckets`, `storage.objects`, `storage.foldername()`;
  - `realtime.messages`, `realtime.topic()`, `realtime.send()` пишет в таблицу для проверок; пустая публикация `supabase_realtime`;
  - роли `anon`, `authenticated`.
- Скрипт `scripts/db-test.sh` поднимает временный кластер, применяет заглушки, миграции и тесты `supabase/tests/*.test.sql`. Тесты используют `do`-блоки с `raise exception` при провале.
- Финальная проверка — применение миграций к настоящему проекту Supabase.
