# Вход через Google и настройки входа в Supabase

Делается один раз, около 10–15 минут. Секреты (Client Secret) никуда, кроме Supabase, не вставлять и в чат не присылать.

## 1. Выключить подтверждение e-mail

Supabase → **Authentication → Sign In / Providers → Email**: выключить **Confirm email** → **Save**.

## 2. Узнать адрес callback Supabase

Supabase → **Authentication → Sign In / Providers → Google**. Там показан **Callback URL**, вида
`https://<project-ref>.supabase.co/auth/v1/callback`. Скопируйте его, он понадобится в шаге 4.

## 3. Google Cloud: экран согласия

1. Откройте https://console.cloud.google.com и войдите своим Google-аккаунтом.
2. Сверху выберите проект → **New Project** → имя `AIU Chat` → **Create**, затем выберите этот проект.
3. Меню → **APIs & Services → OAuth consent screen** (в новом интерфейсе: **Google Auth Platform → Branding**) → **Get started**:
   - App name: `AIU Chat`, User support email: ваш e-mail;
   - Audience: **External**;
   - Contact information: ваш e-mail → **Create**.
4. **Audience** → **Publish app** (статус **In production**). Иначе войти смогут только добавленные вручную тестовые пользователи. Для базовых данных (имя, e-mail, фото) проверка Google не требуется.

## 4. Google Cloud: OAuth-клиент

1. **APIs & Services → Credentials** (или **Google Auth Platform → Clients**) → **Create credentials → OAuth client ID**.
2. Application type: **Web application**, Name: `AIU Chat Web`.
3. **Authorized JavaScript origins**:
   - `https://aiuchatmain-web.vercel.app`
   - `http://localhost:5173`
4. **Authorized redirect URIs**: Callback URL из шага 2 (`https://<project-ref>.supabase.co/auth/v1/callback`).
5. **Create** → скопируйте **Client ID** и **Client Secret**.

## 5. Включить Google в Supabase

Supabase → **Authentication → Sign In / Providers → Google**:
- включить **Enable Sign in with Google**;
- вставить **Client ID** и **Client Secret** → **Save**.

## 6. Проверить адреса перенаправления

Supabase → **Authentication → URL Configuration**:
- Site URL: `https://aiuchatmain-web.vercel.app`
- Redirect URLs: `https://aiuchatmain-web.vercel.app/**` и `http://localhost:5173/**`

Готово. Проверить вход можно будет после этапа 2 на https://aiuchatmain-web.vercel.app/login.
