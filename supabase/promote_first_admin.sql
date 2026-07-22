-- Назначение первого администратора семейного дерева
--
-- Порядок действий:
-- 1. Зарегистрируйтесь на сайте (email + пароль).
-- 2. Замените YOUR_EMAIL@example.com ниже на свой email.
-- 3. Выполните этот скрипт в Supabase SQL Editor.
-- 4. Выйдите из аккаунта на сайте и войдите снова (чтобы обновилась роль).

-- >>> Замените email на свой <<<
update public.profiles p
set
  role = 'admin',
  email = coalesce(p.email, u.email),
  updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR_EMAIL@example.com');

-- Проверка результата
select
  p.id,
  p.email,
  p.role,
  p.updated_at,
  u.email as auth_email
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('YOUR_EMAIL@example.com');
