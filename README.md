# AIU Chat

Веб-мессенджер для студентов Международного университета Астаны (AIU). Группы по предметам, личные сообщения, чат в реальном времени. Интерфейс на казахском, русском и английском, светлая и тёмная тема.

**Сайт:** https://aiuchatmain-web.vercel.app

> Проект в разработке (этап 0 из [плана](docs/PLAN.md)). Сейчас страницы — заготовки, вход и чат появятся на следующих этапах.

## Страницы веб-версии

| Страница | Путь | Ссылка | Статус |
|---|---|---|---|
| Главная (список чатов, поиск групп) | `/` | https://aiuchatmain-web.vercel.app/ | заготовка |
| Чат | `/c/:chatId` | https://aiuchatmain-web.vercel.app/c/demo | заготовка |
| Вступление по ссылке-приглашению | `/join/:code` | https://aiuchatmain-web.vercel.app/join/demo | заготовка |
| Вход и регистрация | `/login` | https://aiuchatmain-web.vercel.app/login | заготовка |
| Настройки (язык, тема, профиль) | `/settings` | https://aiuchatmain-web.vercel.app/settings | язык и тема работают |
| Несуществующая страница | любой другой путь | https://aiuchatmain-web.vercel.app/404 | работает |

`:chatId` — идентификатор чата, `:code` — код приглашения в группу.

## Стек

React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui, react-router, i18next. Backend — Supabase (вход, Postgres, Realtime, Storage). Хостинг — Vercel.

## Запуск локально

Нужен Node.js 18+.

```bash
cd web
npm install
cp .env.example .env   # заполнить ключи Supabase (понадобятся с этапа 1)
npm run dev            # http://localhost:5173
```

Настройка базы данных Supabase: [docs/SETUP_SUPABASE.md](docs/SETUP_SUPABASE.md).

Проверки:

```bash
npm run build
npm run typecheck
npm run lint
```

## Структура

```
docs/PLAN.md      план, архитектура и принятые решения
web/              фронтенд (React)
  src/app/        роутер, layout, темы, i18n
  src/features/   экраны по разделам: auth, chats, messages, settings
  src/components/ общие компоненты и shadcn/ui
  src/locales/    переводы kk / ru / en
supabase/         миграции БД (migrations/), демо-данные (seed.sql), тесты (tests/)
```

## Деплой

Vercel собирает проект из папки `web` (Root Directory = `web`). Все пути отдаются через `index.html` (`web/vercel.json`), поэтому прямые ссылки вроде `/c/demo` открываются без 404.
