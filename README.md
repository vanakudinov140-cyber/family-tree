# Family Tree

Веб-приложение для просмотра и совместного ведения семейного дерева.

## Что это

Интерактивное семейное дерево: художественный режим «Дерево», точная «Схема», профили родственников, роли доступа, предложения правок, импорт JSON и фото в Supabase Storage.

## Основные возможности

- Просмотр семьи в режимах Дерево / Схема
- Фокус на человеке и режимы видимости (ближайшие, 3 поколения, ветка, вся семья)
- Профили, поиск, смена центра
- Роли relative / editor / admin
- Предложения изменений для родственников
- Импорт JSON (admin)
- Фотографии людей (приватный Storage + signed URLs)

## Стек

- Next.js (App Router)
- TypeScript
- React Flow (`@xyflow/react`)
- Supabase (Auth, Postgres, RLS, Realtime, Storage)
- Tailwind CSS
- Vercel (целевой хостинг)

## Локальный запуск

Требования: Node.js 20+ (рекомендуется LTS).

```bash
npm install
cp .env.example .env.local
# заполните NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Откройте приложение в браузере (обычно порт 3000).

Без env-переменных в **development** подключается локальный вымышленный fallback (`src/data/family.ts`). В **production** без env приложение показывает ошибку конфигурации и не подмешивает демо-данные.

## Переменные окружения

См. `.env.example` и подробности в [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

| Переменная | Публичная? | Обязательна? | Где взять |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | да | да (для production) | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | да (anon) | да (для production) | Supabase → Project Settings → API → `anon` `public` key |

Не добавляйте `service_role` в это приложение и не используйте префикс `NEXT_PUBLIC_` для секретов.

## Supabase migrations

Миграции лежат в `supabase/migrations/` (порядок `001`…`007`): схема, Auth/admin writes, edit/delete, типы связей и импорт, фото, роли и предложения, правки RPC.

Применяйте вручную в SQL Editor или через Supabase CLI. Живую базу не меняйте без отдельного решения.

Примеры (не production-данные):

- `supabase/seed.example.sql` — вымышленный seed
- `supabase/promote_first_admin.sql` — назначение первого admin (подставьте свой email)
- `supabase/scripts/remove-test-demid-tretyakov.sql` — ручной cleanup устаревшего тестового stub

`supabase/seed.sql` gitignored — не коммитьте seed с реальными родственниками.

## Роли

- **relative** — просмотр, предложения изменений
- **editor** — редактирование по правилам RLS/RPC
- **admin** — полное администрирование, импорт, управление ролями

## Режимы просмотра

Визуализация:

- **Дерево** — relationship-centered художественный layout
- **Схема** — точный граф связей

Фильтр людей (один набор ID для Дерева и Схемы):

- **Ближайшие** — фокус, супруги, родители, братья/сёстры, прямые дети
- **3 поколения** — расширение ближайших (бабушки/дедушки, внуки, нужные супруги)
- **Вся ветка** — connected component фокуса
- **Вся семья** — все загруженные люди

## Импорт JSON

Формат и правила: `family-data/README.md`.  
Безопасный пример: `family-data/family-import-draft.example.json`.  
Реальный черновик держите только локально (`family-import-draft.json` в `.gitignore`).

## Фото

Фото хранятся в приватном Supabase Storage, в UI отдаются через signed URL. Публичный bucket и `service_role` в клиенте не используются. См. `PHOTO_STORAGE_SETUP.md`.

## Проверки

```bash
npx tsc --noEmit
npm run build
npm run lint

npx tsx tests/family-view-visibility.selftest.ts
npx tsx tests/focused-family-model.selftest.ts
npx tsx tests/relation-to-focus.selftest.ts
npx tsx tests/tree-visibility.selftest.ts
npx tsx tests/person-panel-actions.selftest.ts

# Playwright (нужен уже запущенный dev-сервер на :3000)
npx playwright test tests/person-profile-actions.spec.ts --browser=chromium
```

## Развёртывание

Пошагово (без выполнения на этом этапе): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Политика персональных данных

Чеклист перед публикацией: [docs/PRIVACY_CHECKLIST.md](docs/PRIVACY_CHECKLIST.md).

Реальные семейные данные живут в Supabase, не в публичном Git.

## Что не должно попадать в репозиторий

- `.env.local` и любые секреты / `service_role`
- `family-data/family-import-draft.json` с настоящими родственниками
- приватные audit/review заметки о реальной семье
- `supabase/seed.sql` с реальными людьми
- экспорты, дампы, фото из Storage
- `playwright-report/`, `test-results/`, логи
- содержимое `.next/`, `node_modules/`, `.vercel/`
