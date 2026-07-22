# Deployment guide (GitHub + Vercel)

Этот документ описывает безопасный порядок публикации. На этапе audit команды `git push` / `vercel` **не выполнялись**.

Не вписывайте сюда конкретный production URL, пока он неизвестен.

## 1. Приватный GitHub repository

1. Создайте **private** repository только для `family-tree` (не для родительской папки с другими проектами).
2. Убедитесь, что корень Git = каталог `family-tree` (свой `.git`), либо публикуйте только эту подпапку через отдельный remote.
3. Пройдите [PRIVACY_CHECKLIST.md](./PRIVACY_CHECKLIST.md) до первого push.

## 2. Первый commit

Локально (когда будете готовы):

```bash
# из корня family-tree, в отдельном git-репозитории
git status
git add -A
git status   # ещё раз: нет .env.local, draft.json, seed.sql с PII
git commit -m "Initial family-tree application"
```

Не добавляйте файлы из `.gitignore`. Не коммитьте `service_role`.

## 3. Подключение к Vercel

1. Import private GitHub repository в Vercel.
2. Framework Preset: Next.js.
3. Root Directory: корень приложения (где `package.json`).
4. Build Command: `npm run build`.
5. Output: стандартный Next.js (без кастомного export, если не требуется).

## 4. Env-переменные в Vercel

Добавьте для Production (и Preview при необходимости):

| Name | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |

Не добавляйте `service_role` в Vercel env для этого фронтенда.

## 5. Production build

Проверка до деплоя:

```bash
npx tsc --noEmit
npm run build
npm run start
```

Убедитесь, что PNG из `public/tree-assets/` отдаются как `/tree-assets/tree-*.png`.

## 6. Supabase Auth redirect URLs

В Supabase → Authentication → URL Configuration:

- **Site URL** — ваш production origin (после появления URL)
- **Redirect URLs** — production origin и `https://<project>.vercel.app/**` (и preview-домены при необходимости)
- Для локальной разработки оставьте `http://localhost:3000` и `http://localhost:3000/**`

Не хардкодьте production URL в коде приложения.

## 7. Проверка входа

- Регистрация / вход email+password
- Выход
- Обновление роли после `promote_first_admin.sql` (с вашим email)

## 8. Realtime

После деплоя измените запись в `people` или `relationships` (тестово) и убедитесь, что UI обновляется без перезагрузки. Подписка снимается при размонтировании провайдера.

## 9. Storage

- Загрузка / замена / удаление фото (с правами)
- Signed URL открывается без зависимости от localhost
- Bucket остаётся private

## 10. Mobile

Проверьте ширину ~390px: панель профиля, режимы, зум/pan дерева, auth dialog.

## 11. Откат deployment

В Vercel → Deployments → предыдущий успешный → Promote / Rollback.  
Данные Postgres/Storage при откате фронта не откатываются автоматически.

## 12. Ошибка env

Симптомы:

- экран ошибки «Supabase не настроен…»
- пустой клиент / сбой Auth

Действия:

1. Проверить имена переменных (точно `NEXT_PUBLIC_…`)
2. Redeploy после сохранения env
3. Убедиться, что в бандл не попал `service_role`
4. Не включать локальный fallback в production

## Checklist после первого деплоя

- [ ] Private GitHub
- [ ] Env заданы
- [ ] Auth redirect URLs обновлены
- [ ] Вход/выход
- [ ] Дерево + Схема
- [ ] Realtime
- [ ] Storage photos
- [ ] Mobile 390px
- [ ] Нет секретов в репозитории
