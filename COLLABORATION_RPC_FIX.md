# Исправление RPC — миграция 007

Миграция 007 исправляет ошибку `structure of query does not match function result type` в table-returning RPC из миграции 006.

## Причина

Столбцы `auth.users` в Supabase имеют тип `character varying` / `timestamp without time zone`, а `RETURNS TABLE` в миграции 006 объявлял `text` / `timestamptz`. PostgreSQL требует точного совпадения типов в `RETURN QUERY`.

## Затронутые функции

| Функция | Проблемные столбцы |
|---------|--------------------|
| `admin_list_family_change_proposals` | `u.email` (varchar→text), `pr.full_name` (varchar→text) |
| `admin_list_users` | `u.email`, `u.created_at`, `u.last_sign_in_at`, `u.confirmed_at` |
| `admin_set_user_role` | те же столбцы из `auth.users` |
| `admin_list_audit_log` | явные касты для надёжности |

## Шаги

1. Выполните SQL: `supabase/migrations/007_fix_collaboration_rpc_return_types.sql`
2. Обновите страницу приложения (Ctrl+Shift+R)
3. Откройте **Администрирование** → **Предложения** — пустой список без ошибки
4. Откройте **Пользователи** — список загружается
5. Откройте **Журнал** — пустой список без ошибки

## Диагностические запросы (SQL Editor)

```sql
-- Предложения (пустой список — OK)
select * from public.admin_list_family_change_proposals(null, null, 50, 0);

-- Количество pending
select public.admin_count_pending_proposals();

-- Пользователи
select * from public.admin_list_users();

-- Журнал
select * from public.admin_list_audit_log(50, 0);
```

Все запросы должны выполниться без ошибок. Пустые результаты — нормально, если данных ещё нет.

## Что НЕ изменяется

- Таблицы `people`, `relationships`, `profiles`, `family_change_proposals`, `family_audit_log`
- Данные в любой таблице
- RLS-политики
- Роли пользователей
- Нетабличные RPC (submit, cancel, review и т.д.)
