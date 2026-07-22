-- Family Tree: collaboration roles, proposals, audit log
-- Safe to re-run in Supabase SQL Editor
--
-- BEFORE running:
-- 1. Migrations 001–005 must already be applied
-- 2. See COLLABORATION_SETUP.md
--
-- Does NOT modify existing people/relationships data.
-- Does NOT change existing user roles automatically.

-- ---------------------------------------------------------------------------
-- 1. Extend profiles.role to include editor
-- ---------------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('relative', 'editor', 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Role helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.can_edit_family()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('editor', 'admin')
  );
$$;

revoke all on function public.can_edit_family() from public;
grant execute on function public.can_edit_family() to authenticated;

-- is_admin() unchanged — still admin-only

-- ---------------------------------------------------------------------------
-- 3. people / relationships write policies — editor may insert/update
-- ---------------------------------------------------------------------------

drop policy if exists "Admins insert people" on public.people;
drop policy if exists "Editors insert people" on public.people;
create policy "Editors insert people"
on public.people
for insert
to authenticated
with check (public.can_edit_family());

drop policy if exists "Admins update people" on public.people;
drop policy if exists "Editors update people" on public.people;
create policy "Editors update people"
on public.people
for update
to authenticated
using (public.can_edit_family())
with check (public.can_edit_family());

drop policy if exists "Admins delete people" on public.people;
create policy "Admins delete people"
on public.people
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admins insert relationships" on public.relationships;
drop policy if exists "Editors insert relationships" on public.relationships;
create policy "Editors insert relationships"
on public.relationships
for insert
to authenticated
with check (public.can_edit_family());

drop policy if exists "Admins update relationships" on public.relationships;
drop policy if exists "Editors update relationships" on public.relationships;
create policy "Editors update relationships"
on public.relationships
for update
to authenticated
using (public.can_edit_family())
with check (public.can_edit_family());

drop policy if exists "Admins delete relationships" on public.relationships;
create policy "Admins delete relationships"
on public.relationships
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Audit log
-- ---------------------------------------------------------------------------

create table if not exists public.family_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  before_data jsonb null,
  after_data jsonb null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists family_audit_log_created_at_idx
  on public.family_audit_log (created_at desc);

create index if not exists family_audit_log_action_idx
  on public.family_audit_log (action);

alter table public.family_audit_log enable row level security;

drop policy if exists "family_audit_log_admin_select" on public.family_audit_log;
create policy "family_audit_log_admin_select"
on public.family_audit_log
for select
to authenticated
using (public.is_admin());

create or replace function public.write_family_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_audit_log (
    actor_user_id, action, entity_type, entity_id,
    before_data, after_data, metadata
  ) values (
    auth.uid(), p_action, p_entity_type, p_entity_id,
    p_before_data, p_after_data, p_metadata
  );
end;
$$;

revoke all on function public.write_family_audit_log(text, text, uuid, jsonb, jsonb, jsonb) from public;

-- ---------------------------------------------------------------------------
-- 5. Proposals + messages
-- ---------------------------------------------------------------------------

create table if not exists public.family_change_proposals (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  proposal_type text not null,
  target_person_id uuid null references public.people(id) on delete set null,
  target_relationship_id uuid null references public.relationships(id) on delete set null,
  payload jsonb not null,
  reason text null,
  source_note text null,
  status text not null default 'pending',
  admin_comment text null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint family_change_proposals_type_check
    check (proposal_type in (
      'person_update', 'person_create', 'relationship_create',
      'relationship_update', 'photo_replace'
    )),
  constraint family_change_proposals_status_check
    check (status in ('pending', 'needs_info', 'approved', 'rejected', 'cancelled')),
  constraint family_change_proposals_reason_len_check
    check (reason is null or char_length(reason) <= 2000),
  constraint family_change_proposals_source_note_len_check
    check (source_note is null or char_length(source_note) <= 2000),
  constraint family_change_proposals_admin_comment_len_check
    check (admin_comment is null or char_length(admin_comment) <= 2000)
);

create index if not exists family_change_proposals_submitted_by_idx
  on public.family_change_proposals (submitted_by);
create index if not exists family_change_proposals_status_idx
  on public.family_change_proposals (status);
create index if not exists family_change_proposals_type_idx
  on public.family_change_proposals (proposal_type);
create index if not exists family_change_proposals_target_person_idx
  on public.family_change_proposals (target_person_id);
create index if not exists family_change_proposals_created_at_idx
  on public.family_change_proposals (created_at desc);

create table if not exists public.family_change_proposal_messages (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.family_change_proposals(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  constraint family_change_proposal_messages_len_check
    check (char_length(message) between 1 and 2000)
);

create index if not exists family_change_proposal_messages_proposal_idx
  on public.family_change_proposal_messages (proposal_id, created_at);

alter table public.family_change_proposals enable row level security;
alter table public.family_change_proposal_messages enable row level security;

drop policy if exists "family_proposals_insert_own" on public.family_change_proposals;
create policy "family_proposals_insert_own"
on public.family_change_proposals
for insert
to authenticated
with check (submitted_by = auth.uid());

drop policy if exists "family_proposals_select_own_or_admin" on public.family_change_proposals;
create policy "family_proposals_select_own_or_admin"
on public.family_change_proposals
for select
to authenticated
using (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "family_proposal_messages_select" on public.family_change_proposal_messages;
create policy "family_proposal_messages_select"
on public.family_change_proposal_messages
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.family_change_proposals p
    where p.id = proposal_id
      and p.submitted_by = auth.uid()
  )
);

-- No UPDATE/DELETE policies on proposals — status changes via RPC only.
-- No INSERT policy on messages — inserts via RPC only.

-- ---------------------------------------------------------------------------
-- 6. Proposal photo path validation
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_proposal_photo_path(
  p_path text,
  p_user_id uuid default null
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_path is null or length(trim(p_path)) = 0 then
    return false;
  end if;
  if p_path ~ '\.\.' or p_path ~ '[\\]' or p_path ~* '^https?://' then
    return false;
  end if;
  if p_path !~* '^proposals/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$' then
    return false;
  end if;
  if p_user_id is not null then
    if lower(split_part(p_path, '/', 2)) <> lower(p_user_id::text) then
      return false;
    end if;
  end if;
  return true;
end;
$$;

revoke all on function public.is_valid_proposal_photo_path(text, uuid) from public;
grant execute on function public.is_valid_proposal_photo_path(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Parent cycle helper
-- ---------------------------------------------------------------------------

create or replace function public.would_create_parent_cycle(
  p_parent_id uuid,
  p_child_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  with recursive ancestors as (
    select r.person1_id as person_id
    from public.relationships r
    where r.relationship_type = 'parent'
      and r.person2_id = p_parent_id
    union
    select r.person1_id
    from public.relationships r
    join ancestors a on r.person2_id = a.person_id
    where r.relationship_type = 'parent'
  )
  select exists (
    select 1 from ancestors where person_id = p_child_id
  );
$$;

revoke all on function public.would_create_parent_cycle(uuid, uuid) from public;
grant execute on function public.would_create_parent_cycle(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Update editor-capable RPCs (create_relative, update_person, photos)
-- ---------------------------------------------------------------------------

create or replace function public.create_relative(
  reference_person_id uuid,
  relation_kind text,
  person_data jsonb,
  second_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
  v_first_name text;
  v_middle_name text;
  v_last_name text;
  v_maiden_name text;
  v_gender text;
  v_birth_date date;
  v_birth_year integer;
  v_death_date date;
  v_death_year integer;
  v_birth_place text;
  v_biography text;
  v_is_living boolean;
  v_ref_exists boolean;
  v_parent_id uuid;
  v_second_is_spouse boolean;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if not public.can_edit_family() then
    raise exception 'Добавлять родственников может только редактор или администратор';
  end if;

  if reference_person_id is null then
    raise exception 'Не указан выбранный родственник';
  end if;

  if relation_kind is null
     or relation_kind not in ('father', 'mother', 'spouse', 'child', 'sibling') then
    raise exception 'Недопустимый тип родства';
  end if;

  select exists (
    select 1 from public.people where id = reference_person_id
  ) into v_ref_exists;

  if not v_ref_exists then
    raise exception 'Выбранный родственник не найден';
  end if;

  v_first_name := nullif(trim(coalesce(person_data ->> 'first_name', '')), '');
  if v_first_name is null then
    raise exception 'Имя обязательно';
  end if;

  v_gender := nullif(trim(coalesce(person_data ->> 'gender', '')), '');
  if v_gender is null or v_gender not in ('male', 'female', 'other', 'unknown') then
    raise exception 'Укажите корректный пол';
  end if;

  v_middle_name := nullif(trim(coalesce(person_data ->> 'middle_name', '')), '');
  v_last_name := nullif(trim(coalesce(person_data ->> 'last_name', '')), '');
  v_maiden_name := nullif(trim(coalesce(person_data ->> 'maiden_name', '')), '');
  v_birth_place := nullif(trim(coalesce(person_data ->> 'birth_place', '')), '');
  v_biography := nullif(trim(coalesce(person_data ->> 'biography', '')), '');

  begin
    v_birth_date := nullif(person_data ->> 'birth_date', '')::date;
  exception when others then
    raise exception 'Некорректная дата рождения';
  end;

  begin
    v_death_date := nullif(person_data ->> 'death_date', '')::date;
  exception when others then
    raise exception 'Некорректная дата смерти';
  end;

  begin
    if nullif(person_data ->> 'birth_year', '') is null then
      v_birth_year := null;
    else
      v_birth_year := (person_data ->> 'birth_year')::integer;
    end if;
  exception when others then
    raise exception 'Некорректный год рождения';
  end;

  begin
    if nullif(person_data ->> 'death_year', '') is null then
      v_death_year := null;
    else
      v_death_year := (person_data ->> 'death_year')::integer;
    end if;
  exception when others then
    raise exception 'Некорректный год смерти';
  end;

  if v_birth_date is not null and v_birth_year is not null
     and extract(year from v_birth_date)::integer <> v_birth_year then
    raise exception 'Год рождения не совпадает с датой рождения';
  end if;

  if v_death_date is not null and v_death_year is not null
     and extract(year from v_death_date)::integer <> v_death_year then
    raise exception 'Год смерти не совпадает с датой смерти';
  end if;

  if v_birth_date is not null and v_death_date is not null
     and v_death_date < v_birth_date then
    raise exception 'Дата смерти не может быть раньше даты рождения';
  end if;

  if v_birth_year is not null and v_death_year is not null
     and v_death_year < v_birth_year then
    raise exception 'Год смерти не может быть раньше года рождения';
  end if;

  if v_death_date is not null or v_death_year is not null then
    v_is_living := false;
  elsif person_data ? 'is_living' then
    v_is_living := coalesce((person_data ->> 'is_living')::boolean, true);
  else
    v_is_living := true;
  end if;

  if relation_kind = 'father' then
    v_gender := 'male';
  elsif relation_kind = 'mother' then
    v_gender := 'female';
  end if;

  insert into public.people (
    first_name, middle_name, last_name, maiden_name, gender,
    birth_date, birth_year, death_date, death_year,
    birth_place, biography, is_living, data_status
  ) values (
    v_first_name, v_middle_name, v_last_name, v_maiden_name, v_gender,
    v_birth_date,
    coalesce(v_birth_year, case when v_birth_date is not null then extract(year from v_birth_date)::integer end),
    v_death_date,
    coalesce(v_death_year, case when v_death_date is not null then extract(year from v_death_date)::integer end),
    v_birth_place, v_biography, v_is_living, 'confirmed'
  )
  returning id into v_new_id;

  if relation_kind in ('father', 'mother') then
    if exists (
      select 1 from public.relationships r
      where r.relationship_type = 'parent'
        and r.person1_id = v_new_id
        and r.person2_id = reference_person_id
    ) then
      raise exception 'Такая родительская связь уже существует';
    end if;

    insert into public.relationships (
      person1_id, person2_id, relationship_type, parent_kind, confidence
    ) values (v_new_id, reference_person_id, 'parent', 'biological', 'confirmed');

  elsif relation_kind = 'spouse' then
    if v_new_id = reference_person_id then
      raise exception 'Нельзя создать супружескую связь человека с самим собой';
    end if;

    if exists (
      select 1 from public.relationships r
      where r.relationship_type = 'spouse'
        and (
          (r.person1_id = reference_person_id and r.person2_id = v_new_id)
          or (r.person1_id = v_new_id and r.person2_id = reference_person_id)
        )
    ) then
      raise exception 'Супружеская связь уже существует';
    end if;

    insert into public.relationships (
      person1_id, person2_id, relationship_type, spouse_status, confidence
    ) values (reference_person_id, v_new_id, 'spouse', 'current', 'confirmed');

  elsif relation_kind = 'child' then
    if second_parent_id is not null then
      if second_parent_id = reference_person_id then
        raise exception 'Второй родитель не может совпадать с выбранным человеком';
      end if;

      select exists (
        select 1 from public.relationships r
        where r.relationship_type = 'spouse'
          and (
            (r.person1_id = reference_person_id and r.person2_id = second_parent_id)
            or (r.person1_id = second_parent_id and r.person2_id = reference_person_id)
          )
      ) into v_second_is_spouse;

      if not v_second_is_spouse then
        raise exception 'Второй родитель должен быть супругом выбранного человека';
      end if;
    end if;

    insert into public.relationships (
      person1_id, person2_id, relationship_type, parent_kind, confidence
    ) values (reference_person_id, v_new_id, 'parent', 'biological', 'confirmed');

    if second_parent_id is not null then
      insert into public.relationships (
        person1_id, person2_id, relationship_type, parent_kind, confidence
      ) values (second_parent_id, v_new_id, 'parent', 'biological', 'confirmed');
    end if;

  elsif relation_kind = 'sibling' then
    if not exists (
      select 1 from public.relationships r
      where r.relationship_type = 'parent'
        and r.person2_id = reference_person_id
    ) then
      raise exception 'Сначала добавьте хотя бы одного родителя выбранного человека';
    end if;

    for v_parent_id in
      select r.person1_id
      from public.relationships r
      where r.relationship_type = 'parent'
        and r.person2_id = reference_person_id
    loop
      insert into public.relationships (
        person1_id, person2_id, relationship_type, parent_kind, confidence
      ) values (v_parent_id, v_new_id, 'parent', 'biological', 'confirmed');
    end loop;
  end if;

  return v_new_id;
end;
$$;

revoke all on function public.create_relative(uuid, text, jsonb, uuid) from public;
grant execute on function public.create_relative(uuid, text, jsonb, uuid) to authenticated;

create or replace function public.update_person(
  target_person_id uuid,
  person_data jsonb
)
returns public.people
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_first_name text;
  v_middle_name text;
  v_last_name text;
  v_maiden_name text;
  v_gender text;
  v_birth_date date;
  v_birth_year integer;
  v_death_date date;
  v_death_year integer;
  v_birth_place text;
  v_biography text;
  v_is_living boolean;
  v_row public.people;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if not public.can_edit_family() then
    raise exception 'Редактировать родственников может только редактор или администратор';
  end if;

  if target_person_id is null then
    raise exception 'Не указан человек для редактирования';
  end if;

  select exists (
    select 1 from public.people where id = target_person_id
  ) into v_exists;

  if not v_exists then
    raise exception 'Человек не найден';
  end if;

  if person_data is null or jsonb_typeof(person_data) <> 'object' then
    raise exception 'Некорректные данные для обновления';
  end if;

  v_first_name := nullif(trim(coalesce(person_data ->> 'first_name', '')), '');
  if v_first_name is null then
    raise exception 'Имя обязательно';
  end if;

  v_gender := nullif(trim(coalesce(person_data ->> 'gender', '')), '');
  if v_gender is null or v_gender not in ('male', 'female', 'other', 'unknown') then
    raise exception 'Укажите корректный пол';
  end if;

  v_middle_name := nullif(trim(coalesce(person_data ->> 'middle_name', '')), '');
  v_last_name := nullif(trim(coalesce(person_data ->> 'last_name', '')), '');
  v_maiden_name := nullif(trim(coalesce(person_data ->> 'maiden_name', '')), '');
  v_birth_place := nullif(trim(coalesce(person_data ->> 'birth_place', '')), '');
  v_biography := nullif(trim(coalesce(person_data ->> 'biography', '')), '');

  begin
    v_birth_date := nullif(person_data ->> 'birth_date', '')::date;
  exception
    when others then
      raise exception 'Некорректная дата рождения';
  end;

  begin
    v_death_date := nullif(person_data ->> 'death_date', '')::date;
  exception
    when others then
      raise exception 'Некорректная дата смерти';
  end;

  begin
    if nullif(person_data ->> 'birth_year', '') is null then
      v_birth_year := null;
    else
      v_birth_year := (person_data ->> 'birth_year')::integer;
    end if;
  exception
    when others then
      raise exception 'Некорректный год рождения';
  end;

  begin
    if nullif(person_data ->> 'death_year', '') is null then
      v_death_year := null;
    else
      v_death_year := (person_data ->> 'death_year')::integer;
    end if;
  exception
    when others then
      raise exception 'Некорректный год смерти';
  end;

  if v_birth_year is not null and (v_birth_year < 1000 or v_birth_year > 2100) then
    raise exception 'Год рождения указан некорректно';
  end if;

  if v_death_year is not null and (v_death_year < 1000 or v_death_year > 2100) then
    raise exception 'Год смерти указан некорректно';
  end if;

  if v_birth_date is not null and v_birth_year is not null
     and extract(year from v_birth_date)::integer <> v_birth_year then
    raise exception 'Год рождения не совпадает с датой рождения';
  end if;

  if v_death_date is not null and v_death_year is not null
     and extract(year from v_death_date)::integer <> v_death_year then
    raise exception 'Год смерти не совпадает с датой смерти';
  end if;

  if v_birth_date is not null and v_death_date is not null
     and v_death_date < v_birth_date then
    raise exception 'Дата смерти не может быть раньше даты рождения';
  end if;

  if v_birth_year is not null and v_death_year is not null
     and v_death_year < v_birth_year then
    raise exception 'Год смерти не может быть раньше года рождения';
  end if;

  if v_death_date is not null or v_death_year is not null then
    v_is_living := false;
  elsif person_data ? 'is_living' then
    v_is_living := coalesce((person_data ->> 'is_living')::boolean, true);
  else
    v_is_living := true;
  end if;

  if v_birth_year is null and v_birth_date is not null then
    v_birth_year := extract(year from v_birth_date)::integer;
  end if;

  if v_death_year is null and v_death_date is not null then
    v_death_year := extract(year from v_death_date)::integer;
  end if;

  update public.people
  set
    first_name = v_first_name,
    middle_name = v_middle_name,
    last_name = v_last_name,
    maiden_name = v_maiden_name,
    gender = v_gender,
    birth_date = v_birth_date,
    birth_year = v_birth_year,
    death_date = v_death_date,
    death_year = v_death_year,
    birth_place = v_birth_place,
    biography = v_biography,
    is_living = v_is_living,
    updated_at = now()
  where id = target_person_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_person(uuid, jsonb) from public;
grant execute on function public.update_person(uuid, jsonb) to authenticated;

create or replace function public.set_person_photo(
  target_person_id uuid,
  new_photo_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous text;
  v_row public.people;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if not public.can_edit_family() then
    raise exception 'Изменять фотографии может только редактор или администратор';
  end if;

  if target_person_id is null then
    raise exception 'Не указан человек';
  end if;

  if not public.is_valid_person_photo_path(new_photo_path, target_person_id) then
    raise exception 'Некорректный путь фотографии';
  end if;

  select photo_path into v_previous
  from public.people
  where id = target_person_id
  for update;

  if not found then
    raise exception 'Человек не найден';
  end if;

  update public.people
  set
    photo_path = new_photo_path,
    photo_updated_at = now(),
    updated_at = now()
  where id = target_person_id
  returning * into v_row;

  return jsonb_build_object(
    'person', to_jsonb(v_row),
    'previous_photo_path', v_previous,
    'new_photo_path', v_row.photo_path
  );
end;
$$;

revoke all on function public.set_person_photo(uuid, text) from public;
grant execute on function public.set_person_photo(uuid, text) to authenticated;

create or replace function public.clear_person_photo(
  target_person_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous text;
  v_row public.people;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if not public.can_edit_family() then
    raise exception 'Изменять фотографии может только редактор или администратор';
  end if;

  if target_person_id is null then
    raise exception 'Не указан человек';
  end if;

  select photo_path into v_previous
  from public.people
  where id = target_person_id
  for update;

  if not found then
    raise exception 'Человек не найден';
  end if;

  update public.people
  set
    photo_path = null,
    photo_updated_at = now(),
    updated_at = now()
  where id = target_person_id
  returning * into v_row;

  return jsonb_build_object(
    'person', to_jsonb(v_row),
    'previous_photo_path', v_previous
  );
end;
$$;

revoke all on function public.clear_person_photo(uuid) from public;
grant execute on function public.clear_person_photo(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Storage policies (official + proposal photos)
-- ---------------------------------------------------------------------------

drop policy if exists "person_photos_select_authenticated" on storage.objects;
drop policy if exists "person_photos_insert_admin" on storage.objects;
drop policy if exists "person_photos_delete_admin" on storage.objects;
drop policy if exists "proposal_photos_insert_own" on storage.objects;
drop policy if exists "proposal_photos_select_owner_or_admin" on storage.objects;
drop policy if exists "proposal_photos_delete_owner_or_admin" on storage.objects;

create policy "person_photos_select_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'person-photos'
  and name like 'people/%'
  and public.is_valid_person_photo_path(name, null)
);

create policy "person_photos_insert_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'person-photos'
  and public.can_edit_family()
  and name like 'people/%'
  and public.is_valid_person_photo_path(name, null)
);

create policy "person_photos_delete_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'person-photos'
  and public.can_edit_family()
  and name like 'people/%'
  and public.is_valid_person_photo_path(name, null)
);

create policy "proposal_photos_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'person-photos'
  and name like 'proposals/%'
  and public.is_valid_proposal_photo_path(name, auth.uid())
);

create policy "proposal_photos_select_owner_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'person-photos'
  and name like 'proposals/%'
  and public.is_valid_proposal_photo_path(name, null)
  and (
    public.is_admin()
    or lower(split_part(name, '/', 2)) = lower(auth.uid()::text)
  )
);

create policy "proposal_photos_delete_owner_or_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'person-photos'
  and name like 'proposals/%'
  and public.is_valid_proposal_photo_path(name, null)
  and (
    public.is_admin()
    or (
      lower(split_part(name, '/', 2)) = lower(auth.uid()::text)
      and not exists (
        select 1
        from public.family_change_proposals p
        where p.proposal_type = 'photo_replace'
          and p.status = 'approved'
          and p.payload ->> 'proposalPhotoPath' = name
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- 10. Internal helpers for proposal validation and messages
-- ---------------------------------------------------------------------------

create or replace function public._jsonb_keys_allowed(obj jsonb, allowed text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select obj is not null
    and jsonb_typeof(obj) = 'object'
    and not exists (
      select 1
      from jsonb_object_keys(obj) as k(key)
      where k.key <> all (allowed)
    );
$$;

create or replace function public._proposal_text_is_safe(p_text text, p_max_len integer default 2000)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_text is null
    or (
      char_length(p_text) <= p_max_len
      and p_text !~* '<script'
      and p_text !~* 'javascript:'
    );
$$;

create or replace function public._proposal_parse_optional_text(
  p_value jsonb,
  p_max_len integer default 200
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_text text;
begin
  if p_value is null or p_value = 'null'::jsonb then
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'string' then
    raise exception 'Ожидалась текстовая строка';
  end if;
  v_text := nullif(trim(p_value #>> '{}'), '');
  if v_text is not null and char_length(v_text) > p_max_len then
    raise exception 'Слишком длинный текст (максимум % символов)', p_max_len;
  end if;
  if not public._proposal_text_is_safe(v_text, p_max_len) then
    raise exception 'Недопустимое содержимое текста';
  end if;
  return v_text;
end;
$$;

create or replace function public._proposal_parse_optional_int(
  p_value jsonb,
  p_min integer,
  p_max integer
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_num integer;
begin
  if p_value is null or p_value = 'null'::jsonb then
    return null;
  end if;
  begin
    v_num := (p_value #>> '{}')::integer;
  exception when others then
    raise exception 'Ожидалось целое число';
  end;
  if v_num < p_min or v_num > p_max then
    raise exception 'Число вне допустимого диапазона';
  end if;
  return v_num;
end;
$$;

create or replace function public._proposal_parse_optional_date(p_value jsonb)
returns date
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_value is null or p_value = 'null'::jsonb then
    return null;
  end if;
  begin
    return nullif(p_value #>> '{}', '')::date;
  exception when others then
    raise exception 'Некорректная дата';
  end;
end;
$$;

create or replace function public.insert_family_change_proposal_message(
  p_proposal_id uuid,
  p_author_id uuid,
  p_message text
)
returns public.family_change_proposal_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_change_proposal_messages;
begin
  if p_message is null or char_length(trim(p_message)) = 0 then
    raise exception 'Сообщение не может быть пустым';
  end if;
  if char_length(p_message) > 2000 then
    raise exception 'Сообщение слишком длинное';
  end if;
  if not public._proposal_text_is_safe(p_message, 2000) then
    raise exception 'Недопустимое содержимое сообщения';
  end if;

  insert into public.family_change_proposal_messages (
    proposal_id, author_id, message
  ) values (
    p_proposal_id, p_author_id, trim(p_message)
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.insert_family_change_proposal_message(uuid, uuid, text) from public;
grant execute on function public.insert_family_change_proposal_message(uuid, uuid, text) to authenticated;

create or replace function public.format_person_display_name(p_person public.people)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(concat_ws(
    ' ',
    nullif(trim(p_person.last_name), ''),
    nullif(trim(p_person.first_name), ''),
    nullif(trim(p_person.middle_name), '')
  ));
$$;

create or replace function public.find_similar_people_for_proposal(
  p_first_name text,
  p_last_name text default null,
  p_maiden_name text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'middleName', p.middle_name,
        'displayName', public.format_person_display_name(p)
      )
      order by p.last_name nulls last, p.first_name
    ),
    '[]'::jsonb
  )
  from public.people p
  where lower(trim(p.first_name)) = lower(trim(p_first_name))
    and (
      p_last_name is null
      or p.last_name is null
      or lower(trim(p.last_name)) = lower(trim(p_last_name))
    );
$$;

revoke all on function public.find_similar_people_for_proposal(text, text, text) from public;

create or replace function public.validate_family_change_proposal_payload(
  p_proposal_type text,
  p_payload jsonb,
  p_target_person_id uuid default null,
  p_target_relationship_id uuid default null,
  p_submitter_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_changes jsonb;
  v_person jsonb;
  v_relation jsonb;
  v_person1_id uuid;
  v_person2_id uuid;
  v_relationship_id uuid;
  v_relationship_type text;
  v_parent_kind text;
  v_spouse_status text;
  v_confidence text;
  v_anchor_id uuid;
  v_rel_type text;
  v_photo_path text;
  v_first_name text;
  v_gender text;
  v_birth_date date;
  v_birth_year integer;
  v_death_date date;
  v_death_year integer;
  v_before_rel public.relationships;
begin
  if p_proposal_type is null
     or p_proposal_type not in (
       'person_update', 'person_create', 'relationship_create',
       'relationship_update', 'photo_replace'
     ) then
    raise exception 'Недопустимый тип предложения';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Некорректный payload предложения';
  end if;

  if p_proposal_type = 'person_update' then
    if not public._jsonb_keys_allowed(p_payload, array['changes']) then
      raise exception 'Недопустимые поля в payload';
    end if;
    v_changes := p_payload -> 'changes';
    if v_changes is null or jsonb_typeof(v_changes) <> 'object' then
      raise exception 'Укажите изменения';
    end if;
    if not public._jsonb_keys_allowed(v_changes, array[
      'firstName', 'middleName', 'lastName', 'maidenName',
      'birthDate', 'birthYear', 'deathDate', 'deathYear',
      'birthPlace', 'biography', 'isLiving', 'notes'
    ]) then
      raise exception 'Недопустимые поля в изменениях';
    end if;
    if (select count(*) from jsonb_object_keys(v_changes)) = 0 then
      raise exception 'Укажите хотя бы одно изменение';
    end if;
    if p_target_person_id is null then
      raise exception 'Не указан человек для изменения';
    end if;
    if not exists (select 1 from public.people where id = p_target_person_id) then
      raise exception 'Человек не найден';
    end if;

    if v_changes ? 'firstName' then
      v_first_name := public._proposal_parse_optional_text(v_changes -> 'firstName', 200);
      if v_first_name is null then
        raise exception 'Имя обязательно';
      end if;
    end if;

    perform public._proposal_parse_optional_text(v_changes -> 'middleName', 200);
    perform public._proposal_parse_optional_text(v_changes -> 'lastName', 200);
    perform public._proposal_parse_optional_text(v_changes -> 'maidenName', 200);
    perform public._proposal_parse_optional_text(v_changes -> 'birthPlace', 500);
    perform public._proposal_parse_optional_text(v_changes -> 'biography', 10000);
    perform public._proposal_parse_optional_text(v_changes -> 'notes', 2000);

    v_birth_date := public._proposal_parse_optional_date(v_changes -> 'birthDate');
    v_death_date := public._proposal_parse_optional_date(v_changes -> 'deathDate');
    v_birth_year := public._proposal_parse_optional_int(v_changes -> 'birthYear', 1000, 2100);
    v_death_year := public._proposal_parse_optional_int(v_changes -> 'deathYear', 1000, 2100);

    if v_birth_date is not null and v_birth_year is not null
       and extract(year from v_birth_date)::integer <> v_birth_year then
      raise exception 'Год рождения не совпадает с датой рождения';
    end if;
    if v_death_date is not null and v_death_year is not null
       and extract(year from v_death_date)::integer <> v_death_year then
      raise exception 'Год смерти не совпадает с датой смерти';
    end if;
    if v_birth_date is not null and v_death_date is not null and v_death_date < v_birth_date then
      raise exception 'Дата смерти не может быть раньше даты рождения';
    end if;
    if v_birth_year is not null and v_death_year is not null and v_death_year < v_birth_year then
      raise exception 'Год смерти не может быть раньше года рождения';
    end if;

  elsif p_proposal_type = 'person_create' then
    if not public._jsonb_keys_allowed(p_payload, array['person', 'relation']) then
      raise exception 'Недопустимые поля в payload';
    end if;
    v_person := p_payload -> 'person';
    v_relation := p_payload -> 'relation';
    if v_person is null or jsonb_typeof(v_person) <> 'object' then
      raise exception 'Не указаны данные человека';
    end if;
    if v_relation is null or jsonb_typeof(v_relation) <> 'object' then
      raise exception 'Не указана связь с существующим родственником';
    end if;
    if not public._jsonb_keys_allowed(v_person, array[
      'firstName', 'middleName', 'lastName', 'maidenName', 'gender',
      'birthDate', 'birthYear', 'deathDate', 'deathYear',
      'birthPlace', 'biography', 'isLiving', 'notes'
    ]) then
      raise exception 'Недопустимые поля в данных человека';
    end if;
    if not public._jsonb_keys_allowed(v_relation, array[
      'anchorPersonId', 'type', 'parentKind', 'spouseStatus', 'confidence'
    ]) then
      raise exception 'Недопустимые поля в связи';
    end if;

    v_first_name := public._proposal_parse_optional_text(v_person -> 'firstName', 200);
    if v_first_name is null then
      raise exception 'Имя обязательно';
    end if;
    v_gender := public._proposal_parse_optional_text(v_person -> 'gender', 20);
    if v_gender is null or v_gender not in ('male', 'female', 'other', 'unknown') then
      raise exception 'Укажите корректный пол';
    end if;

    perform public._proposal_parse_optional_text(v_person -> 'middleName', 200);
    perform public._proposal_parse_optional_text(v_person -> 'lastName', 200);
    perform public._proposal_parse_optional_text(v_person -> 'maidenName', 200);
    perform public._proposal_parse_optional_text(v_person -> 'birthPlace', 500);
    perform public._proposal_parse_optional_text(v_person -> 'biography', 10000);
    perform public._proposal_parse_optional_text(v_person -> 'notes', 2000);

    v_birth_date := public._proposal_parse_optional_date(v_person -> 'birthDate');
    v_death_date := public._proposal_parse_optional_date(v_person -> 'deathDate');
    v_birth_year := public._proposal_parse_optional_int(v_person -> 'birthYear', 1000, 2100);
    v_death_year := public._proposal_parse_optional_int(v_person -> 'deathYear', 1000, 2100);

    if v_birth_date is not null and v_birth_year is not null
       and extract(year from v_birth_date)::integer <> v_birth_year then
      raise exception 'Год рождения не совпадает с датой рождения';
    end if;
    if v_death_date is not null and v_death_year is not null
       and extract(year from v_death_date)::integer <> v_death_year then
      raise exception 'Год смерти не совпадает с датой смерти';
    end if;

    begin
      v_anchor_id := (v_relation ->> 'anchorPersonId')::uuid;
    exception when others then
      raise exception 'Некорректный anchorPersonId';
    end;
    if not exists (select 1 from public.people where id = v_anchor_id) then
      raise exception 'Опорный родственник не найден';
    end if;

    v_rel_type := v_relation ->> 'type';
    if v_rel_type is null or v_rel_type not in ('parent', 'child', 'spouse') then
      raise exception 'Недопустимый тип связи';
    end if;

    v_parent_kind := nullif(v_relation ->> 'parentKind', '');
    if v_parent_kind is not null
       and v_parent_kind not in ('biological', 'adoptive', 'step', 'guardian') then
      raise exception 'Недопустимый parentKind';
    end if;
    v_spouse_status := nullif(v_relation ->> 'spouseStatus', '');
    if v_spouse_status is not null
       and v_spouse_status not in ('current', 'former', 'unknown') then
      raise exception 'Недопустимый spouseStatus';
    end if;
    v_confidence := coalesce(nullif(v_relation ->> 'confidence', ''), 'confirmed');
    if v_confidence not in ('confirmed', 'probable', 'uncertain') then
      raise exception 'Недопустимый confidence';
    end if;

    if v_rel_type in ('parent', 'child') then
      v_parent_kind := coalesce(v_parent_kind, 'biological');
    elsif v_rel_type = 'spouse' then
      v_spouse_status := coalesce(v_spouse_status, 'current');
    end if;

  elsif p_proposal_type = 'relationship_create' then
    if not public._jsonb_keys_allowed(p_payload, array[
      'person1Id', 'person2Id', 'relationshipType',
      'parentKind', 'spouseStatus', 'confidence', 'notes'
    ]) then
      raise exception 'Недопустимые поля в payload';
    end if;

    begin
      v_person1_id := (p_payload ->> 'person1Id')::uuid;
      v_person2_id := (p_payload ->> 'person2Id')::uuid;
    exception when others then
      raise exception 'Некорректные идентификаторы людей';
    end;

    if v_person1_id = v_person2_id then
      raise exception 'Нельзя связать человека с самим собой';
    end if;
    if not exists (select 1 from public.people where id = v_person1_id) then
      raise exception 'Первый человек не найден';
    end if;
    if not exists (select 1 from public.people where id = v_person2_id) then
      raise exception 'Второй человек не найден';
    end if;

    v_relationship_type := p_payload ->> 'relationshipType';
    if v_relationship_type is null or v_relationship_type not in ('parent', 'spouse') then
      raise exception 'Недопустимый тип связи';
    end if;

    v_parent_kind := nullif(p_payload ->> 'parentKind', '');
    v_spouse_status := nullif(p_payload ->> 'spouseStatus', '');
    v_confidence := coalesce(nullif(p_payload ->> 'confidence', ''), 'confirmed');

    if v_confidence not in ('confirmed', 'probable', 'uncertain') then
      raise exception 'Недопустимый confidence';
    end if;
    perform public._proposal_parse_optional_text(to_jsonb(p_payload ->> 'notes'), 2000);

    if v_relationship_type = 'parent' then
      v_parent_kind := coalesce(v_parent_kind, 'biological');
      if v_parent_kind not in ('biological', 'adoptive', 'step', 'guardian') then
        raise exception 'Недопустимый parentKind';
      end if;
      if exists (
        select 1 from public.relationships r
        where r.relationship_type = 'parent'
          and r.person1_id = v_person1_id
          and r.person2_id = v_person2_id
      ) then
        raise exception 'Такая родительская связь уже существует';
      end if;
      if public.would_create_parent_cycle(v_person1_id, v_person2_id) then
        raise exception 'Создание связи приведёт к циклическому родству';
      end if;
    else
      v_spouse_status := coalesce(v_spouse_status, 'current');
      if v_spouse_status not in ('current', 'former', 'unknown') then
        raise exception 'Недопустимый spouseStatus';
      end if;
      if exists (
        select 1 from public.relationships r
        where r.relationship_type = 'spouse'
          and (
            (r.person1_id = v_person1_id and r.person2_id = v_person2_id)
            or (r.person1_id = v_person2_id and r.person2_id = v_person1_id)
          )
      ) then
        raise exception 'Супружеская связь уже существует';
      end if;
    end if;

  elsif p_proposal_type = 'relationship_update' then
    if not public._jsonb_keys_allowed(p_payload, array['relationshipId', 'changes']) then
      raise exception 'Недопустимые поля в payload';
    end if;
    v_changes := p_payload -> 'changes';
    if v_changes is null or jsonb_typeof(v_changes) <> 'object' then
      raise exception 'Укажите изменения связи';
    end if;
    if not public._jsonb_keys_allowed(v_changes, array[
      'person1Id', 'person2Id', 'parentKind', 'spouseStatus', 'confidence', 'notes'
    ]) then
      raise exception 'Недопустимые поля в изменениях связи';
    end if;
    if (select count(*) from jsonb_object_keys(v_changes)) = 0 then
      raise exception 'Укажите хотя бы одно изменение';
    end if;

    begin
      v_relationship_id := (p_payload ->> 'relationshipId')::uuid;
    exception when others then
      raise exception 'Некорректный relationshipId';
    end;

    if p_target_relationship_id is not null and p_target_relationship_id <> v_relationship_id then
      raise exception 'relationshipId не совпадает с target_relationship_id';
    end if;

    if not exists (select 1 from public.relationships where id = v_relationship_id) then
      raise exception 'Связь не найдена';
    end if;

    perform public._proposal_parse_optional_text(v_changes -> 'notes', 2000);

    if v_changes ? 'parentKind' then
      v_parent_kind := nullif(v_changes ->> 'parentKind', '');
      if v_parent_kind is not null
         and v_parent_kind not in ('biological', 'adoptive', 'step', 'guardian') then
        raise exception 'Недопустимый parentKind';
      end if;
    end if;
    if v_changes ? 'spouseStatus' then
      v_spouse_status := nullif(v_changes ->> 'spouseStatus', '');
      if v_spouse_status is not null
         and v_spouse_status not in ('current', 'former', 'unknown') then
        raise exception 'Недопустимый spouseStatus';
      end if;
    end if;
    if v_changes ? 'confidence' then
      v_confidence := nullif(v_changes ->> 'confidence', '');
      if v_confidence is not null
         and v_confidence not in ('confirmed', 'probable', 'uncertain') then
        raise exception 'Недопустимый confidence';
      end if;
    end if;

    select * into v_before_rel
    from public.relationships
    where id = v_relationship_id;

    v_person1_id := coalesce(
      case when v_changes ? 'person1Id' then (v_changes ->> 'person1Id')::uuid end,
      v_before_rel.person1_id
    );
    v_person2_id := coalesce(
      case when v_changes ? 'person2Id' then (v_changes ->> 'person2Id')::uuid end,
      v_before_rel.person2_id
    );

    if v_person1_id = v_person2_id then
      raise exception 'Нельзя связать человека с самим собой';
    end if;

    if v_before_rel.relationship_type = 'parent' then
      if exists (
        select 1 from public.relationships r
        where r.relationship_type = 'parent'
          and r.person1_id = v_person1_id
          and r.person2_id = v_person2_id
          and r.id <> v_relationship_id
      ) then
        raise exception 'Такая родительская связь уже существует';
      end if;
      if public.would_create_parent_cycle(v_person1_id, v_person2_id) then
        raise exception 'Изменение связи приведёт к циклическому родству';
      end if;
    elsif v_before_rel.relationship_type = 'spouse' then
      if exists (
        select 1 from public.relationships r
        where r.relationship_type = 'spouse'
          and r.id <> v_relationship_id
          and (
            (r.person1_id = v_person1_id and r.person2_id = v_person2_id)
            or (r.person1_id = v_person2_id and r.person2_id = v_person1_id)
          )
      ) then
        raise exception 'Супружеская связь уже существует';
      end if;
    end if;

  elsif p_proposal_type = 'photo_replace' then
    if not public._jsonb_keys_allowed(p_payload, array['proposalPhotoPath']) then
      raise exception 'Недопустимые поля в payload';
    end if;
    v_photo_path := p_payload ->> 'proposalPhotoPath';
    if p_submitter_id is null then
      raise exception 'Не указан автор предложения';
    end if;
    if not public.is_valid_proposal_photo_path(v_photo_path, p_submitter_id) then
      raise exception 'Некорректный путь предложенной фотографии';
    end if;
    if p_target_person_id is null then
      raise exception 'Не указан человек для замены фотографии';
    end if;
    if not exists (select 1 from public.people where id = p_target_person_id) then
      raise exception 'Человек не найден';
    end if;
  end if;
end;
$$;

revoke all on function public.validate_family_change_proposal_payload(text, jsonb, uuid, uuid, uuid) from public;

create or replace function public._apply_person_update_proposal(
  p_person_id uuid,
  p_changes jsonb
)
returns public.people
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.people;
  v_row public.people;
  v_first_name text;
  v_middle_name text;
  v_last_name text;
  v_maiden_name text;
  v_birth_date date;
  v_birth_year integer;
  v_death_date date;
  v_death_year integer;
  v_birth_place text;
  v_biography text;
  v_notes text;
  v_is_living boolean;
begin
  select * into v_before
  from public.people
  where id = p_person_id
  for update;

  if not found then
    raise exception 'Человек не найден';
  end if;

  v_first_name := coalesce(
    public._proposal_parse_optional_text(p_changes -> 'firstName', 200),
    v_before.first_name
  );
  v_middle_name := case
    when p_changes ? 'middleName' then public._proposal_parse_optional_text(p_changes -> 'middleName', 200)
    else v_before.middle_name
  end;
  v_last_name := case
    when p_changes ? 'lastName' then public._proposal_parse_optional_text(p_changes -> 'lastName', 200)
    else v_before.last_name
  end;
  v_maiden_name := case
    when p_changes ? 'maidenName' then public._proposal_parse_optional_text(p_changes -> 'maidenName', 200)
    else v_before.maiden_name
  end;
  v_birth_place := case
    when p_changes ? 'birthPlace' then public._proposal_parse_optional_text(p_changes -> 'birthPlace', 500)
    else v_before.birth_place
  end;
  v_biography := case
    when p_changes ? 'biography' then public._proposal_parse_optional_text(p_changes -> 'biography', 10000)
    else v_before.biography
  end;
  v_notes := case
    when p_changes ? 'notes' then public._proposal_parse_optional_text(p_changes -> 'notes', 2000)
    else v_before.notes
  end;

  v_birth_date := case
    when p_changes ? 'birthDate' then public._proposal_parse_optional_date(p_changes -> 'birthDate')
    else v_before.birth_date
  end;
  v_death_date := case
    when p_changes ? 'deathDate' then public._proposal_parse_optional_date(p_changes -> 'deathDate')
    else v_before.death_date
  end;
  v_birth_year := case
    when p_changes ? 'birthYear' then public._proposal_parse_optional_int(p_changes -> 'birthYear', 1000, 2100)
    else v_before.birth_year
  end;
  v_death_year := case
    when p_changes ? 'deathYear' then public._proposal_parse_optional_int(p_changes -> 'deathYear', 1000, 2100)
    else v_before.death_year
  end;

  if v_birth_date is not null and v_birth_year is not null
     and extract(year from v_birth_date)::integer <> v_birth_year then
    raise exception 'Год рождения не совпадает с датой рождения';
  end if;
  if v_death_date is not null and v_death_year is not null
     and extract(year from v_death_date)::integer <> v_death_year then
    raise exception 'Год смерти не совпадает с датой смерти';
  end if;
  if v_birth_date is not null and v_death_date is not null and v_death_date < v_birth_date then
    raise exception 'Дата смерти не может быть раньше даты рождения';
  end if;
  if v_birth_year is not null and v_death_year is not null and v_death_year < v_birth_year then
    raise exception 'Год смерти не может быть раньше года рождения';
  end if;

  if v_death_date is not null or v_death_year is not null then
    v_is_living := false;
  elsif p_changes ? 'isLiving' then
    if p_changes -> 'isLiving' is null or p_changes -> 'isLiving' = 'null'::jsonb then
      v_is_living := v_before.is_living;
    else
      v_is_living := coalesce((p_changes ->> 'isLiving')::boolean, true);
    end if;
  else
    v_is_living := v_before.is_living;
  end if;

  if v_birth_year is null and v_birth_date is not null then
    v_birth_year := extract(year from v_birth_date)::integer;
  end if;
  if v_death_year is null and v_death_date is not null then
    v_death_year := extract(year from v_death_date)::integer;
  end if;

  update public.people
  set
    first_name = v_first_name,
    middle_name = v_middle_name,
    last_name = v_last_name,
    maiden_name = v_maiden_name,
    birth_date = v_birth_date,
    birth_year = v_birth_year,
    death_date = v_death_date,
    death_year = v_death_year,
    birth_place = v_birth_place,
    biography = v_biography,
    notes = v_notes,
    is_living = v_is_living,
    updated_at = now()
  where id = p_person_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public._apply_person_update_proposal(uuid, jsonb) from public;

create or replace function public._apply_person_create_proposal(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person jsonb;
  v_relation jsonb;
  v_new_id uuid;
  v_anchor_id uuid;
  v_rel_type text;
  v_parent_kind text;
  v_spouse_status text;
  v_confidence text;
  v_first_name text;
  v_middle_name text;
  v_last_name text;
  v_maiden_name text;
  v_gender text;
  v_birth_date date;
  v_birth_year integer;
  v_death_date date;
  v_death_year integer;
  v_birth_place text;
  v_biography text;
  v_notes text;
  v_is_living boolean;
  v_rel_id uuid;
  v_parent_id uuid;
  v_child_id uuid;
begin
  v_person := p_payload -> 'person';
  v_relation := p_payload -> 'relation';

  v_first_name := public._proposal_parse_optional_text(v_person -> 'firstName', 200);
  v_middle_name := public._proposal_parse_optional_text(v_person -> 'middleName', 200);
  v_last_name := public._proposal_parse_optional_text(v_person -> 'lastName', 200);
  v_maiden_name := public._proposal_parse_optional_text(v_person -> 'maidenName', 200);
  v_gender := public._proposal_parse_optional_text(v_person -> 'gender', 20);
  v_birth_place := public._proposal_parse_optional_text(v_person -> 'birthPlace', 500);
  v_biography := public._proposal_parse_optional_text(v_person -> 'biography', 10000);
  v_notes := public._proposal_parse_optional_text(v_person -> 'notes', 2000);
  v_birth_date := public._proposal_parse_optional_date(v_person -> 'birthDate');
  v_death_date := public._proposal_parse_optional_date(v_person -> 'deathDate');
  v_birth_year := public._proposal_parse_optional_int(v_person -> 'birthYear', 1000, 2100);
  v_death_year := public._proposal_parse_optional_int(v_person -> 'deathYear', 1000, 2100);

  if v_death_date is not null or v_death_year is not null then
    v_is_living := false;
  elsif v_person ? 'isLiving' and v_person -> 'isLiving' is not null and v_person -> 'isLiving' <> 'null'::jsonb then
    v_is_living := coalesce((v_person ->> 'isLiving')::boolean, true);
  else
    v_is_living := true;
  end if;

  insert into public.people (
    first_name, middle_name, last_name, maiden_name, gender,
    birth_date, birth_year, death_date, death_year,
    birth_place, biography, notes, is_living, data_status
  ) values (
    v_first_name, v_middle_name, v_last_name, v_maiden_name, v_gender,
    v_birth_date,
    coalesce(v_birth_year, case when v_birth_date is not null then extract(year from v_birth_date)::integer end),
    v_death_date,
    coalesce(v_death_year, case when v_death_date is not null then extract(year from v_death_date)::integer end),
    v_birth_place, v_biography, v_notes, v_is_living, 'confirmed'
  )
  returning id into v_new_id;

  v_anchor_id := (v_relation ->> 'anchorPersonId')::uuid;
  v_rel_type := v_relation ->> 'type';
  v_parent_kind := coalesce(nullif(v_relation ->> 'parentKind', ''), 'biological');
  v_spouse_status := coalesce(nullif(v_relation ->> 'spouseStatus', ''), 'current');
  v_confidence := coalesce(nullif(v_relation ->> 'confidence', ''), 'confirmed');

  if v_rel_type = 'parent' then
    v_parent_id := v_new_id;
    v_child_id := v_anchor_id;
  elsif v_rel_type = 'child' then
    v_parent_id := v_anchor_id;
    v_child_id := v_new_id;
  elsif v_rel_type = 'spouse' then
    insert into public.relationships (
      person1_id, person2_id, relationship_type, spouse_status, confidence
    ) values (
      v_anchor_id, v_new_id, 'spouse', v_spouse_status, v_confidence
    )
    returning id into v_rel_id;

    return jsonb_build_object(
      'person_id', v_new_id,
      'relationship_id', v_rel_id
    );
  end if;

  if exists (
    select 1 from public.relationships r
    where r.relationship_type = 'parent'
      and r.person1_id = v_parent_id
      and r.person2_id = v_child_id
  ) then
    raise exception 'Такая родительская связь уже существует';
  end if;

  if public.would_create_parent_cycle(v_parent_id, v_child_id) then
    raise exception 'Создание связи приведёт к циклическому родству';
  end if;

  insert into public.relationships (
    person1_id, person2_id, relationship_type, parent_kind, confidence
  ) values (
    v_parent_id, v_child_id, 'parent', v_parent_kind, v_confidence
  )
  returning id into v_rel_id;

  return jsonb_build_object(
    'person_id', v_new_id,
    'relationship_id', v_rel_id
  );
end;
$$;

revoke all on function public._apply_person_create_proposal(jsonb) from public;

create or replace function public._apply_relationship_create_proposal(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person1_id uuid;
  v_person2_id uuid;
  v_relationship_type text;
  v_parent_kind text;
  v_spouse_status text;
  v_confidence text;
  v_notes text;
  v_rel_id uuid;
begin
  v_person1_id := (p_payload ->> 'person1Id')::uuid;
  v_person2_id := (p_payload ->> 'person2Id')::uuid;
  v_relationship_type := p_payload ->> 'relationshipType';
  v_confidence := coalesce(nullif(p_payload ->> 'confidence', ''), 'confirmed');
  v_notes := public._proposal_parse_optional_text(to_jsonb(p_payload ->> 'notes'), 2000);

  if v_relationship_type = 'parent' then
    v_parent_kind := coalesce(nullif(p_payload ->> 'parentKind', ''), 'biological');
    insert into public.relationships (
      person1_id, person2_id, relationship_type, parent_kind, confidence, notes
    ) values (
      v_person1_id, v_person2_id, 'parent', v_parent_kind, v_confidence, v_notes
    )
    returning id into v_rel_id;
  else
    v_spouse_status := coalesce(nullif(p_payload ->> 'spouseStatus', ''), 'current');
    insert into public.relationships (
      person1_id, person2_id, relationship_type, spouse_status, confidence, notes
    ) values (
      v_person1_id, v_person2_id, 'spouse', v_spouse_status, v_confidence, v_notes
    )
    returning id into v_rel_id;
  end if;

  return v_rel_id;
end;
$$;

revoke all on function public._apply_relationship_create_proposal(jsonb) from public;

create or replace function public._apply_relationship_update_proposal(
  p_relationship_id uuid,
  p_changes jsonb
)
returns public.relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.relationships;
  v_row public.relationships;
  v_person1_id uuid;
  v_person2_id uuid;
  v_parent_kind text;
  v_spouse_status text;
  v_confidence text;
  v_notes text;
begin
  select * into v_before
  from public.relationships
  where id = p_relationship_id
  for update;

  if not found then
    raise exception 'Связь не найдена';
  end if;

  v_person1_id := coalesce(
    case when p_changes ? 'person1Id' then (p_changes ->> 'person1Id')::uuid end,
    v_before.person1_id
  );
  v_person2_id := coalesce(
    case when p_changes ? 'person2Id' then (p_changes ->> 'person2Id')::uuid end,
    v_before.person2_id
  );

  if v_person1_id = v_person2_id then
    raise exception 'Нельзя связать человека с самим собой';
  end if;

  if not exists (select 1 from public.people where id = v_person1_id) then
    raise exception 'Первый человек не найден';
  end if;
  if not exists (select 1 from public.people where id = v_person2_id) then
    raise exception 'Второй человек не найден';
  end if;

  v_parent_kind := case
    when p_changes ? 'parentKind' then nullif(p_changes ->> 'parentKind', '')
    else v_before.parent_kind
  end;
  v_spouse_status := case
    when p_changes ? 'spouseStatus' then nullif(p_changes ->> 'spouseStatus', '')
    else v_before.spouse_status
  end;
  v_confidence := coalesce(
    case when p_changes ? 'confidence' then nullif(p_changes ->> 'confidence', '') end,
    v_before.confidence
  );
  v_notes := case
    when p_changes ? 'notes' then public._proposal_parse_optional_text(p_changes -> 'notes', 2000)
    else v_before.notes
  end;

  if v_before.relationship_type = 'parent' then
    if exists (
      select 1 from public.relationships r
      where r.relationship_type = 'parent'
        and r.person1_id = v_person1_id
        and r.person2_id = v_person2_id
        and r.id <> p_relationship_id
    ) then
      raise exception 'Такая родительская связь уже существует';
    end if;
    if public.would_create_parent_cycle(v_person1_id, v_person2_id) then
      raise exception 'Изменение связи приведёт к циклическому родству';
    end if;
    v_parent_kind := coalesce(v_parent_kind, 'biological');
    v_spouse_status := null;
  else
    if exists (
      select 1 from public.relationships r
      where r.relationship_type = 'spouse'
        and r.id <> p_relationship_id
        and (
          (r.person1_id = v_person1_id and r.person2_id = v_person2_id)
          or (r.person1_id = v_person2_id and r.person2_id = v_person1_id)
        )
    ) then
      raise exception 'Супружеская связь уже существует';
    end if;
    v_spouse_status := coalesce(v_spouse_status, 'unknown');
    v_parent_kind := null;
  end if;

  update public.relationships
  set
    person1_id = v_person1_id,
    person2_id = v_person2_id,
    parent_kind = v_parent_kind,
    spouse_status = v_spouse_status,
    confidence = v_confidence,
    notes = v_notes
  where id = p_relationship_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public._apply_relationship_update_proposal(uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- 11. Proposal RPCs — submit / list / cancel / resubmit / messages
-- ---------------------------------------------------------------------------

create or replace function public.submit_family_change_proposal(
  proposal_type text,
  target_person_id uuid default null,
  target_relationship_id uuid default null,
  payload jsonb default null,
  reason text default null,
  source_note text default null
)
returns public.family_change_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_row public.family_change_proposals;
  v_relationship_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if reason is not null then
    if char_length(reason) > 2000 or not public._proposal_text_is_safe(reason, 2000) then
      raise exception 'Некорректный комментарий';
    end if;
  end if;
  if source_note is not null then
    if char_length(source_note) > 2000 or not public._proposal_text_is_safe(source_note, 2000) then
      raise exception 'Некорректный источник информации';
    end if;
  end if;

  if proposal_type = 'relationship_update' and payload is not null then
    begin
      v_relationship_id := (payload ->> 'relationshipId')::uuid;
    exception when others then
      v_relationship_id := null;
    end;
    if target_relationship_id is null then
      target_relationship_id := v_relationship_id;
    end if;
  end if;

  perform public.validate_family_change_proposal_payload(
    proposal_type, payload, target_person_id, target_relationship_id, v_uid
  );

  insert into public.family_change_proposals (
    submitted_by, proposal_type, target_person_id, target_relationship_id,
    payload, reason, source_note, status
  ) values (
    v_uid, proposal_type, target_person_id, target_relationship_id,
    payload, nullif(trim(reason), ''), nullif(trim(source_note), ''), 'pending'
  )
  returning * into v_row;

  perform public.write_family_audit_log(
    'proposal_submitted',
    'family_change_proposal',
    v_row.id,
    null,
    to_jsonb(v_row),
    jsonb_build_object('proposal_type', proposal_type)
  );

  return v_row;
end;
$$;

revoke all on function public.submit_family_change_proposal(text, uuid, uuid, jsonb, text, text) from public;
grant execute on function public.submit_family_change_proposal(text, uuid, uuid, jsonb, text, text) to authenticated;

create or replace function public.list_my_family_change_proposals()
returns setof public.family_change_proposals
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  return query
  select p.*
  from public.family_change_proposals p
  where p.submitted_by = auth.uid()
  order by p.created_at desc;
end;
$$;

revoke all on function public.list_my_family_change_proposals() from public;
grant execute on function public.list_my_family_change_proposals() to authenticated;

create or replace function public.cancel_my_family_change_proposal(proposal_id uuid)
returns public.family_change_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_change_proposals;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  select * into v_row
  from public.family_change_proposals
  where id = proposal_id
  for update;

  if not found then
    raise exception 'Предложение не найдено';
  end if;

  if v_row.submitted_by <> auth.uid() then
    raise exception 'Можно отменить только собственное предложение';
  end if;

  if v_row.status not in ('pending', 'needs_info') then
    raise exception 'Это предложение уже обработано и не может быть отменено';
  end if;

  update public.family_change_proposals
  set
    status = 'cancelled',
    updated_at = now()
  where id = proposal_id
  returning * into v_row;

  perform public.write_family_audit_log(
    'proposal_cancelled',
    'family_change_proposal',
    v_row.id,
    null,
    to_jsonb(v_row),
    null
  );

  return v_row;
end;
$$;

revoke all on function public.cancel_my_family_change_proposal(uuid) from public;
grant execute on function public.cancel_my_family_change_proposal(uuid) to authenticated;

create or replace function public.resubmit_family_change_proposal(
  proposal_id uuid,
  new_payload jsonb,
  response_comment text default null
)
returns public.family_change_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_change_proposals;
  v_before jsonb;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  select * into v_row
  from public.family_change_proposals
  where id = proposal_id
  for update;

  if not found then
    raise exception 'Предложение не найдено';
  end if;

  if v_row.submitted_by <> auth.uid() then
    raise exception 'Можно изменить только собственное предложение';
  end if;

  if v_row.status <> 'needs_info' then
    raise exception 'Повторная отправка доступна только после запроса уточнения';
  end if;

  perform public.validate_family_change_proposal_payload(
    v_row.proposal_type,
    new_payload,
    v_row.target_person_id,
    v_row.target_relationship_id,
    auth.uid()
  );

  v_before := to_jsonb(v_row);

  update public.family_change_proposals
  set
    payload = new_payload,
    status = 'pending',
    version = version + 1,
    updated_at = now()
  where id = proposal_id
  returning * into v_row;

  if response_comment is not null and char_length(trim(response_comment)) > 0 then
    perform public.insert_family_change_proposal_message(
      proposal_id, auth.uid(), response_comment
    );
  end if;

  perform public.write_family_audit_log(
    'proposal_resubmitted',
    'family_change_proposal',
    v_row.id,
    v_before,
    to_jsonb(v_row),
    null
  );

  return v_row;
end;
$$;

revoke all on function public.resubmit_family_change_proposal(uuid, jsonb, text) from public;
grant execute on function public.resubmit_family_change_proposal(uuid, jsonb, text) to authenticated;

create or replace function public.list_proposal_messages(proposal_id uuid)
returns setof public.family_change_proposal_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.family_change_proposals;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  select * into v_proposal
  from public.family_change_proposals
  where id = proposal_id;

  if not found then
    raise exception 'Предложение не найдено';
  end if;

  if v_proposal.submitted_by <> auth.uid() and not public.is_admin() then
    raise exception 'Нет доступа к сообщениям предложения';
  end if;

  return query
  select m.*
  from public.family_change_proposal_messages m
  where m.proposal_id = proposal_id
  order by m.created_at asc;
end;
$$;

revoke all on function public.list_proposal_messages(uuid) from public;
grant execute on function public.list_proposal_messages(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Admin proposal RPCs — list / count / review / approve photo
-- ---------------------------------------------------------------------------

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
    p.proposal_type,
    p.target_person_id,
    p.target_relationship_id,
    p.payload,
    p.reason,
    p.source_note,
    p.status,
    p.admin_comment,
    p.reviewed_by,
    p.reviewed_at,
    p.created_at,
    p.updated_at,
    p.version,
    u.email as submitter_email,
    coalesce(nullif(trim(pr.full_name), ''), u.email) as submitter_name,
    case
      when tp.id is not null then public.format_person_display_name(tp)
      else null
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

create or replace function public.admin_count_pending_proposals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  if not public.is_admin() then
    raise exception 'Доступ только для администратора';
  end if;

  select count(*)::integer into v_count
  from public.family_change_proposals
  where status = 'pending';

  return v_count;
end;
$$;

revoke all on function public.admin_count_pending_proposals() from public;
grant execute on function public.admin_count_pending_proposals() to authenticated;

create or replace function public.review_family_change_proposal(
  proposal_id uuid,
  action text,
  admin_comment text default null,
  confirm_duplicates boolean default false
)
returns public.family_change_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_change_proposals;
  v_before jsonb;
  v_before_person public.people;
  v_after_person public.people;
  v_before_rel public.relationships;
  v_after_rel public.relationships;
  v_changes jsonb;
  v_person jsonb;
  v_duplicates jsonb;
  v_create_result jsonb;
  v_new_rel_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  if not public.is_admin() then
    raise exception 'Доступ только для администратора';
  end if;

  if action is null or action not in ('approve', 'reject', 'request_info') then
    raise exception 'Недопустимое действие';
  end if;

  select * into v_row
  from public.family_change_proposals
  where id = proposal_id
  for update;

  if not found then
    raise exception 'Предложение не найдено';
  end if;

  if v_row.status in ('approved', 'rejected', 'cancelled') then
    raise exception 'Предложение уже обработано';
  end if;

  if v_row.proposal_type = 'photo_replace' then
    raise exception 'Для фотографий используйте approve_photo_change_proposal';
  end if;

  v_before := to_jsonb(v_row);

  perform public.validate_family_change_proposal_payload(
    v_row.proposal_type,
    v_row.payload,
    v_row.target_person_id,
    v_row.target_relationship_id,
    v_row.submitted_by
  );

  if action = 'request_info' then
    if admin_comment is null or char_length(trim(admin_comment)) = 0 then
      raise exception 'Укажите комментарий для автора';
    end if;
    if char_length(admin_comment) > 2000 or not public._proposal_text_is_safe(admin_comment, 2000) then
      raise exception 'Некорректный комментарий администратора';
    end if;

    update public.family_change_proposals
    set
      status = 'needs_info',
      admin_comment = trim(admin_comment),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    where id = proposal_id
    returning * into v_row;

    perform public.insert_family_change_proposal_message(
      proposal_id, auth.uid(), admin_comment
    );

    perform public.write_family_audit_log(
      'proposal_info_requested',
      'family_change_proposal',
      v_row.id,
      v_before,
      to_jsonb(v_row),
      null
    );

    return v_row;
  end if;

  if action = 'reject' then
    if admin_comment is null or char_length(trim(admin_comment)) = 0 then
      raise exception 'Укажите причину отклонения';
    end if;
    if char_length(admin_comment) > 2000 or not public._proposal_text_is_safe(admin_comment, 2000) then
      raise exception 'Некорректный комментарий администратора';
    end if;

    update public.family_change_proposals
    set
      status = 'rejected',
      admin_comment = trim(admin_comment),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    where id = proposal_id
    returning * into v_row;

    perform public.insert_family_change_proposal_message(
      proposal_id, auth.uid(), admin_comment
    );

    perform public.write_family_audit_log(
      'proposal_rejected',
      'family_change_proposal',
      v_row.id,
      v_before,
      to_jsonb(v_row),
      null
    );

    return v_row;
  end if;

  -- approve
  if action = 'approve' then
    if admin_comment is not null
       and (char_length(admin_comment) > 2000 or not public._proposal_text_is_safe(admin_comment, 2000)) then
      raise exception 'Некорректный комментарий администратора';
    end if;

    if v_row.proposal_type = 'person_update' then
      select * into v_before_person
      from public.people
      where id = v_row.target_person_id;

      v_changes := v_row.payload -> 'changes';
      v_after_person := public._apply_person_update_proposal(v_row.target_person_id, v_changes);

      perform public.write_family_audit_log(
        'person_updated_from_proposal',
        'person',
        v_after_person.id,
        to_jsonb(v_before_person),
        to_jsonb(v_after_person),
        jsonb_build_object('proposal_id', v_row.id)
      );

    elsif v_row.proposal_type = 'person_create' then
      v_person := v_row.payload -> 'person';
      v_duplicates := public.find_similar_people_for_proposal(
        public._proposal_parse_optional_text(v_person -> 'firstName', 200),
        public._proposal_parse_optional_text(v_person -> 'lastName', 200),
        public._proposal_parse_optional_text(v_person -> 'maidenName', 200)
      );

      if jsonb_array_length(v_duplicates) > 0 and not confirm_duplicates then
        raise exception 'Найдены возможные дубликаты (%). Подтвердите создание с confirm_duplicates=true.',
          v_duplicates::text;
      end if;

      v_create_result := public._apply_person_create_proposal(v_row.payload);

      perform public.write_family_audit_log(
        'person_created_from_proposal',
        'person',
        (v_create_result ->> 'person_id')::uuid,
        null,
        v_create_result,
        jsonb_build_object(
          'proposal_id', v_row.id,
          'possible_duplicates', v_duplicates
        )
      );

    elsif v_row.proposal_type = 'relationship_create' then
      v_new_rel_id := public._apply_relationship_create_proposal(v_row.payload);

      select * into v_after_rel
      from public.relationships
      where id = v_new_rel_id;

      perform public.write_family_audit_log(
        'relationship_created_from_proposal',
        'relationship',
        v_new_rel_id,
        null,
        to_jsonb(v_after_rel),
        jsonb_build_object('proposal_id', v_row.id)
      );

    elsif v_row.proposal_type = 'relationship_update' then
      v_changes := v_row.payload -> 'changes';
      select * into v_before_rel
      from public.relationships
      where id = coalesce(v_row.target_relationship_id, (v_row.payload ->> 'relationshipId')::uuid);

      v_after_rel := public._apply_relationship_update_proposal(
        coalesce(v_row.target_relationship_id, (v_row.payload ->> 'relationshipId')::uuid),
        v_changes
      );

      perform public.write_family_audit_log(
        'relationship_updated_from_proposal',
        'relationship',
        v_after_rel.id,
        to_jsonb(v_before_rel),
        to_jsonb(v_after_rel),
        jsonb_build_object('proposal_id', v_row.id)
      );
    end if;

    update public.family_change_proposals
    set
      status = 'approved',
      admin_comment = nullif(trim(admin_comment), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    where id = proposal_id
    returning * into v_row;

    perform public.write_family_audit_log(
      'proposal_approved',
      'family_change_proposal',
      v_row.id,
      v_before,
      to_jsonb(v_row),
      jsonb_build_object('proposal_type', v_row.proposal_type)
    );

    return v_row;
  end if;

  raise exception 'Недопустимое действие';
end;
$$;

revoke all on function public.review_family_change_proposal(uuid, text, text, boolean) from public;
grant execute on function public.review_family_change_proposal(uuid, text, text, boolean) to authenticated;

create or replace function public.approve_photo_change_proposal(
  proposal_id uuid,
  official_photo_path text,
  admin_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_change_proposals;
  v_before jsonb;
  v_before_person public.people;
  v_after_person public.people;
  v_previous_photo_path text;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  if not public.is_admin() then
    raise exception 'Доступ только для администратора';
  end if;

  select * into v_row
  from public.family_change_proposals
  where id = proposal_id
  for update;

  if not found then
    raise exception 'Предложение не найдено';
  end if;

  if v_row.status in ('approved', 'rejected', 'cancelled') then
    raise exception 'Предложение уже обработано';
  end if;

  if v_row.proposal_type <> 'photo_replace' then
    raise exception 'Это предложение не связано с фотографией';
  end if;

  if v_row.target_person_id is null then
    raise exception 'Не указан человек';
  end if;

  perform public.validate_family_change_proposal_payload(
    v_row.proposal_type,
    v_row.payload,
    v_row.target_person_id,
    v_row.target_relationship_id,
    v_row.submitted_by
  );

  if not public.is_valid_person_photo_path(official_photo_path, v_row.target_person_id) then
    raise exception 'Некорректный путь официальной фотографии';
  end if;

  if admin_comment is not null
     and (char_length(admin_comment) > 2000 or not public._proposal_text_is_safe(admin_comment, 2000)) then
    raise exception 'Некорректный комментарий администратора';
  end if;

  v_before := to_jsonb(v_row);

  select * into v_before_person
  from public.people
  where id = v_row.target_person_id
  for update;

  if not found then
    raise exception 'Человек не найден';
  end if;

  v_previous_photo_path := v_before_person.photo_path;

  update public.people
  set
    photo_path = official_photo_path,
    photo_updated_at = now(),
    updated_at = now()
  where id = v_row.target_person_id
  returning * into v_after_person;

  update public.family_change_proposals
  set
    status = 'approved',
    admin_comment = nullif(trim(admin_comment), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = proposal_id
  returning * into v_row;

  perform public.write_family_audit_log(
    'photo_changed_from_proposal',
    'person',
    v_after_person.id,
    jsonb_build_object('photo_path', v_previous_photo_path),
    jsonb_build_object('photo_path', v_after_person.photo_path),
    jsonb_build_object(
      'proposal_id', v_row.id,
      'proposal_photo_path', v_row.payload ->> 'proposalPhotoPath',
      'official_photo_path', official_photo_path
    )
  );

  perform public.write_family_audit_log(
    'proposal_approved',
    'family_change_proposal',
    v_row.id,
    v_before,
    to_jsonb(v_row),
    jsonb_build_object('proposal_type', 'photo_replace')
  );

  return jsonb_build_object(
    'proposal', to_jsonb(v_row),
    'previous_photo_path', v_previous_photo_path
  );
end;
$$;

revoke all on function public.approve_photo_change_proposal(uuid, text, text) from public;
grant execute on function public.approve_photo_change_proposal(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Admin user management and audit log RPCs
-- ---------------------------------------------------------------------------

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
    u.id as user_id,
    u.email,
    coalesce(p.role, 'relative') as role,
    u.created_at,
    u.last_sign_in_at,
    u.confirmed_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at asc nulls last;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

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

  select p.role into v_old_role
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
    u.id as user_id,
    u.email,
    coalesce(p.role, 'relative') as role,
    u.created_at,
    u.last_sign_in_at,
    u.confirmed_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = target_user_id;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

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
    l.id,
    l.actor_user_id,
    l.action,
    l.entity_type,
    l.entity_id,
    l.before_data,
    l.after_data,
    l.metadata,
    l.created_at
  from public.family_audit_log l
  order by l.created_at desc
  limit limit_count
  offset offset_count;
end;
$$;

revoke all on function public.admin_list_audit_log(integer, integer) from public;
grant execute on function public.admin_list_audit_log(integer, integer) to authenticated;

