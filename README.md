# AIU Chat

Веб-мессенджер для студентов Международного университета Астаны (AIU). Группы по предметам, личные сообщения, чат в реальном времени. Интерфейс на казахском, русском и английском, светлая и тёмная тема.

**Сайт:** https://aiuchatmain-web.vercel.app

## Возможности

- Вход через Google или e-mail и пароль, онбординг профиля (имя, @username, курс, специальность).
- Группы по предметам: публичные (находятся поиском, вступить может любой) и приватные (только по ссылке-приглашению).
- Поиск и вступление в группы, ссылки-приглашения `/join/<код>`, роли: admin удаляет сообщения и участников, назначает других admin.
- Личные сообщения по @username.
- Сообщения в реальном времени, ответы, реакции, удаление, непрочитанные.
- Фото и голосовые сообщения, аватарки профилей и групп.
- Языки kk / ru / en, светлая и тёмная тема.
- Адаптивная вёрстка: десктоп и телефон (жесты, безопасные отступы).

## Маршруты

`/` (список чатов), `/c/:chatId` (чат), `/c/:chatId/info` (о группе), `/join/:code` (приглашение), `/login`, `/onboarding`, `/settings`.

## Стек

React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui, react-router, TanStack Query, i18next, Motion. Backend — Supabase (Auth, Postgres с RLS, Realtime, Storage). Хостинг — Vercel.

## Структура репозитория

```
docs/             PLAN.md (план и решения), DB.md (схема БД), SETUP_SUPABASE.md, SETUP_GOOGLE.md, DEMO.md
web/              фронтенд (React)
  src/app/        роутер, layout, темы, i18n
  src/features/   auth, chats, messages, settings
  src/components/ общие компоненты и shadcn/ui
  src/locales/    переводы kk / ru / en
supabase/
  migrations/     миграции БД
  seed.sql        демо-группы
  tests/          тесты БД
  ops/            ручные SQL: очистка тестовых данных, admin для демо-групп
scripts/          db-test.sh
```

## Запуск локально

Нужен Node.js 18+.

```bash
cd web
npm install
cp .env.example .env   # VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:5173
```

База данных и ключи: [docs/SETUP_SUPABASE.md](docs/SETUP_SUPABASE.md). Вход через Google: [docs/SETUP_GOOGLE.md](docs/SETUP_GOOGLE.md).

## Проверки

```bash
cd web
npm run typecheck
npm run lint
npm run build
npm run i18n:check
```

Тесты БД (нужен PostgreSQL 16), из корня: `bash scripts/db-test.sh`.

## Деплой на Vercel

Root Directory = `web`. Все пути отдаются через `index.html` (`web/vercel.json`), поэтому прямые ссылки вроде `/c/<id>` открываются без 404. Переменные окружения: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

Production-деплой создаётся при каждом пуше в ветку `claude/laughing-davinci-x4qz6l` (текущая production-ветка проекта). Если production-ветка изменится: Vercel → **Settings → Git → Production Branch** → указать новую ветку и сделать пуш (или **Redeploy**).

Если сайт перестал открываться («you don't have a production deployment»): Vercel → **Deployments** → у последнего деплоя со статусом Ready **⋯ → Promote to Production**, либо сделать пуш в production-ветку. Проверить **Settings → Domains**: `aiuchatmain-web.vercel.app` привязан к Production.

## Документация

- [docs/PLAN.md](docs/PLAN.md) — план, архитектура, принятые решения
- [docs/DB.md](docs/DB.md) — схема БД, RLS, RPC
- [docs/SETUP_SUPABASE.md](docs/SETUP_SUPABASE.md) — настройка Supabase
- [docs/SETUP_GOOGLE.md](docs/SETUP_GOOGLE.md) — вход через Google
- [docs/DEMO.md](docs/DEMO.md) — чек-лист перед показом
- [supabase/ops/](supabase/ops/) — SQL для администрирования
