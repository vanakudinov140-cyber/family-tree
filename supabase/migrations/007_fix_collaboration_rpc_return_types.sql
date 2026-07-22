-- Family Tree: fix table-returning RPC type mismatches from migration 006
-- Safe to re-run in Supabase SQL Editor
--
-- Root cause: auth.users columns are varchar / timestamp, but RETURNS TABLE
-- declared text / timestamptz → "structure of query does not match function result type".
--
-- Fix: explicit casts in every RETURN QUERY SELECT.
-- No table changes. No data changes.

-- ---------------------------------------------------------------------------
-- 1. admin_list_family_change_proposals — PRIMARY FIX
-- ---------------------------------------------------------------------------

drop function if exists public.admin_list_family_change_proposals(text, text, integer, integer);

create or replace function public.admin_list_family_change_proposals(
  status_filter text default null,
  type_filter text default null,
  limit_count integer default 50,
  offset_count integer default 0
)
returns table (
  id uuid,
  submitted_by uuid,
  proposal_type text,
  target_person_id uuid,
  target_relationship_id uuid,
  payload jsonb,
  reason text,
  source_note text,
  status text,
  admin_comment text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  version integer,
  submitter_email text,
  submitter_name text,
  target_person_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  if not public.is_admin() then
    raise exception 'Доступ только для администратора';
  end if;

  limit_count := greatest(coalesce(limit_count, 50), 1);
  offset_count := greatest(coalesce(offset_count, 0), 0);

  return query
  select
    p.id,
    p.submitted_by,
    p.proposal_type::text,
    p.target_person_id,
    p.target_relationship_id,
    p.payload::jsonb,
    p.reason::text,
    p.source_note::text,
    p.status::text,
    p.admin_comment::text,
    p.reviewed_by,
    p.reviewed_at::timestamptz,
    p.created_at::timestamptz,
    p.updated_at::timestamptz,
    p.version::integer,
    u.email::text as submitter_email,
    coalesce(nullif(trim(pr.full_name::text), ''), u.email::text)::text as submitter_name,
    case
      when tp.id is not null then public.format_person_display_name(tp)::text
      else null::text
    end as target_person_name
  from public.family_change_proposals p
  left join auth.users u on u.id = p.submitted_by
  left join public.profiles pr on pr.id = p.submitted_by
  left join public.people tp on tp.id = p.target_person_id
  where (status_filter is null or p.status = status_filter)
    and (type_filter is null or p.proposal_type = type_filter)
  order by p.created_at desc
  limit limit_count
  offset offset_count;
end;
$$;

revoke all on function public.admin_list_family_change_proposals(text, text, integer, integer) from public;
grant execute on function public.admin_list_family_change_proposals(text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. admin_list_users
-- ---------------------------------------------------------------------------

drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  if not public.is_admin() then
    raise exception 'Доступ только для администратора';
  end if;

  return query
  select
    u.id::uuid as user_id,
    u.email::text,
    coalesce(p.role, 'relative')::text as role,
    u.created_at::timestamptz,
    u.last_sign_in_at::timestamptz,
    u.confirmed_at::timestamptz
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at asc nulls last;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_set_user_role
-- ---------------------------------------------------------------------------

drop function if exists public.admin_set_user_role(uuid, text);

create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role text
)
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role text;
  v_admin_count integer;
  v_user_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  if not public.is_admin() then
    raise exception 'Доступ только для администратора';
  end if;

  if target_user_id is null then
    raise exception 'Не указан пользователь';
  end if;

  if new_role is null or new_role not in ('relative', 'editor', 'admin') then
    raise exception 'Недопустимая роль';
  end if;

  select exists (
    select 1 from auth.users where id = target_user_id
  ) into v_user_exists;

  if not v_user_exists then
    raise exception 'Пользователь не найден. Назначить роль можно только зарегистрированному пользователю';
  end if;

  select p.role::text into v_old_role
  from public.profiles p
  where p.id = target_user_id
  for update;

  if not found then
    raise exception 'Профиль пользователя не найден';
  end if;

  if target_user_id = auth.uid() and new_role <> 'admin' and v_old_role = 'admin' then
    raise exception 'Нельзя понизить собственную роль администратора';
  end if;

  if v_old_role = 'admin' and new_role <> 'admin' then
    select count(*)::integer into v_admin_count
    from public.profiles
    where role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'Нельзя понизить последнего администратора';
    end if;
  end if;

  update public.profiles
  set
    role = new_role,
    updated_at = now()
  where id = target_user_id;

  perform public.write_family_audit_log(
    'user_role_changed',
    'profile',
    target_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', new_role),
    jsonb_build_object(
      'target_user_id', target_user_id,
      'changed_by', auth.uid()
    )
  );

  return query
  select
    u.id::uuid as user_id,
    u.email::text,
    coalesce(p.role, 'relative')::text as role,
    u.created_at::timestamptz,
    u.last_sign_in_at::timestamptz,
    u.confirmed_at::timestamptz
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = target_user_id;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_list_audit_log — explicit casts for safety
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_audit_log(
  limit_count integer default 100,
  offset_count integer default 0
)
returns table (
  id uuid,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  if not public.is_admin() then
    raise exception 'Доступ только для администратора';
  end if;

  limit_count := greatest(coalesce(limit_count, 100), 1);
  offset_count := greatest(coalesce(offset_count, 0), 0);

  return query
  select
    l.id::uuid,
    l.actor_user_id::uuid,
    l.action::text,
    l.entity_type::text,
    l.entity_id::uuid,
    l.before_data::jsonb,
    l.after_data::jsonb,
    l.metadata::jsonb,
    l.created_at::timestamptz
  from public.family_audit_log l
  order by l.created_at desc
  limit limit_count
  offset offset_count;
end;
$$;

revoke all on function public.admin_list_audit_log(integer, integer) from public;
grant execute on function public.admin_list_audit_log(integer, integer) to authenticated;
