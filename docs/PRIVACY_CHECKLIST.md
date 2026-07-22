# Privacy checklist before GitHub / Vercel

Используйте перед первым push и перед каждым крупным обновлением.

## Repository

- [ ] GitHub repository **private**
- [ ] Корень репозитория — только `family-tree` (не родительский monorepo с чужими проектами)
- [ ] История Git не содержит случайно добавленных `.env.local` / ключей

## Secrets

- [ ] `.env.local` не в индексе Git (`git check-ignore -v .env.local`)
- [ ] Нет `service_role` в коде, README, SQL, тестах, JSON
- [ ] В env только `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Нет JWT secret, GitHub tokens, паролей в репозитории

## Family data files

- [ ] `family-data/family-import-draft.json` в `.gitignore` (реальный черновик локально)
- [ ] В репозитории только `family-import-draft.example.json` / template с вымышленными данными
- [ ] `CURRENT_TEST_DATA_AUDIT.md` и `FAMILY_REVIEW.md` не публикуются
- [ ] `supabase/seed.sql` не содержит реальных родственников (в репо — `seed.example.sql`)

## Storage & media

- [ ] Фото из Supabase Storage не копируются в `public/`
- [ ] PNG в `public/tree-assets/` — только декоративное дерево без чужих лиц/ФИО
- [ ] Нет скриншотов с реальными ФИО в `test-results/` / `playwright-report/`

## SQL

- [ ] Миграции — структура/RPC/RLS без персональных INSERT реальной семьи
- [ ] `promote_first_admin.sql` использует placeholder email, не личный адрес
- [ ] Cleanup-скрипты ручные и безопасные

## Runtime / logs

- [ ] `treeDebug` / `viewDebug` / `dataDebug` работают только при `NODE_ENV === "development"`
- [ ] Production не пишет console.table с UUID/ФИО
- [ ] Production при настроенном Supabase не подмешивает локальный fallback

## Screenshots & CI artifacts

- [ ] `playwright-report/` и `test-results/` в `.gitignore`
- [ ] Перед push: `git status` без артефактов тестов

## Final gate

- [ ] `npx tsc --noEmit` проходит
- [ ] `npm run build` проходит
- [ ] Решение о публикации реальных данных в GitHub принято отдельно (по умолчанию — **нет**)
