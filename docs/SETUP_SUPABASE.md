# Настройка Supabase (пошагово)

Нужно один раз создать структуру базы данных (таблицы, права доступа, хранилище файлов) и добавить демо-группы. Выберите вариант A (без терминала, проще) или B.

## Вариант A. Через сайт Supabase (без терминала)

1. Откройте https://supabase.com/dashboard и выберите свой проект.
2. Слева выберите **SQL Editor**, нажмите **New query**.
3. Откройте на своём компьютере файлы из папки `supabase/migrations/` и выполняйте их **строго по порядку имён**:
   1. `20261014000100_tables.sql`
   2. `20261014000200_rls.sql`
   3. `20261014000300_rpc.sql`
   4. `20261014000400_storage.sql`
   5. `20261015000100_invites_leave.sql` (ссылки-приглашения и выход из группы)

   Для каждого файла: скопируйте всё содержимое, вставьте в редактор (при необходимости создайте новый запрос через **New query**), нажмите **Run**. Должно появиться `Success`. Если вылезла ошибка, остановитесь и пришлите её текст.
4. Затем так же выполните `supabase/seed.sql` (демо-группы). Его можно запускать повторно, дубликаты не появятся.

**Важно:** файл `supabase/tests/_stubs.sql` запускать НЕЛЬЗЯ. Он нужен только для локальных тестов и сломает настоящий проект. Остальные файлы из `supabase/tests/` тоже не нужны.

**Как проверить:**
- **Table Editor** показывает 7 таблиц: `profiles`, `chats`, `chat_members`, `messages`, `attachments`, `reactions`, `direct_pairs`.
- В таблице `chats` 6 групп.
- **Storage** показывает 2 бакета: `chat-media` и `avatars`.

**Если база уже настроена раньше:** примените только миграцию `20261015000100_invites_leave.sql` в SQL Editor (скопировать файл целиком, **Run**, должно появиться `Success`). До этого ссылки-приглашения `/join/<код>` и выход из группы не работают.

## Вариант B. Через терминал

Нужен Node.js 18+. В терминале, в папке проекта:

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

`<ref>` — идентификатор проекта: Project Settings → General → Reference ID. При `link` может потребоваться пароль базы данных (задавался при создании проекта; сбросить можно в Project Settings → Database).

Демо-данные: у команды `npx supabase db push` есть флаг `--include-seed` (проверено по `npx supabase db push --help`), но он берёт seed «из вашей конфигурации» (`supabase/config.toml`), а в проекте этого файла нет, поэтому работу флага для удалённого проекта мы не проверяли. Надёжнее выполнить `supabase/seed.sql` в SQL Editor, как в варианте A, шаг 4.

## Ключи для сайта

1. В Supabase: **Project Settings → API**. Скопируйте **Project URL** и **publishable key** (в старом интерфейсе он называется `anon` key). Эти ключи безопасно использовать в браузере.
2. Локально: в папке `web` скопируйте `.env.example` в `.env` и заполните:
   ```
   VITE_SUPABASE_URL=<Project URL>
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   ```
3. На Vercel: **Project → Settings → Environment Variables**, добавьте те же две переменные (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`), затем **Deployments → Redeploy**, чтобы сайт пересобрался с ключами.

**Никогда не используйте и не публикуйте `service_role` / secret key.** Он даёт полный доступ к базе в обход всех правил. В репозиторий и в `.env` сайта его не кладут.

## Вход через Google и ссылки

**Authentication → URL Configuration**:
- Site URL: `https://aiuchatmain-web.vercel.app`
- Redirect URLs (добавьте оба):
  - `https://aiuchatmain-web.vercel.app/**`
  - `http://localhost:5173/**`

## Локальные тесты БД (необязательно)

Нужен PostgreSQL 16 (установленные серверные пакеты). Из корня проекта:

```bash
bash scripts/db-test.sh
```

Скрипт поднимает временную базу, применяет заглушки, миграции, seed и тесты. Успех: `PASS` для каждого файла `01`–`05`.
