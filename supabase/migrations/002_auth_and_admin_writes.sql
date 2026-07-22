-- Family Tree: auth profiles, admin writes, create_relative RPC, realtime
-- Safe to re-run in Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'relative'
    check (role in ('relative', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'relative'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- is_admin() is created below; policy recreated after the function exists.

-- ---------------------------------------------------------------------------
-- 2. is_admin() — SECURITY DEFINER to avoid RLS recursion on profiles
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
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
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins read profiles" on public.profiles;
create policy "Admins read profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies for profiles via the client.
-- Role changes must be done in SQL Editor (see promote_first_admin.sql).

-- ---------------------------------------------------------------------------
-- 3. Write policies for people / relationships (admin only)
-- ---------------------------------------------------------------------------

drop policy if exists "Admins insert people" on public.people;
create policy "Admins insert people"
on public.people
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins update people" on public.people;
create policy "Admins update people"
on public.people
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins delete people" on public.people;
create policy "Admins delete people"
on public.people
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admins insert relationships" on public.relationships;
create policy "Admins insert relationships"
on public.relationships
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins update relationships" on public.relationships;
create policy "Admins update relationships"
on public.relationships
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins delete relationships" on public.relationships;
create policy "Admins delete relationships"
on public.relationships
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. create_relative — atomic person + relationship creation
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

  if not public.is_admin() then
    raise exception 'Добавлять родственников может только администратор';
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
    first_name,
    middle_name,
    last_name,
    maiden_name,
    gender,
    birth_date,
    birth_year,
    death_date,
    death_year,
    birth_place,
    biography,
    is_living
  ) values (
    v_first_name,
    v_middle_name,
    v_last_name,
    v_maiden_name,
    v_gender,
    v_birth_date,
    coalesce(v_birth_year, case when v_birth_date is not null then extract(year from v_birth_date)::integer end),
    v_death_date,
    coalesce(v_death_year, case when v_death_date is not null then extract(year from v_death_date)::integer end),
    v_birth_place,
    v_biography,
    v_is_living
  )
  returning id into v_new_id;

  if relation_kind in ('father', 'mother') then
    if exists (
      select 1
      from public.relationships r
      where r.relationship_type = 'parent'
        and r.person1_id = v_new_id
        and r.person2_id = reference_person_id
    ) then
      raise exception 'Такая родительская связь уже существует';
    end if;

    insert into public.relationships (person1_id, person2_id, relationship_type)
    values (v_new_id, reference_person_id, 'parent');

  elsif relation_kind = 'spouse' then
    if v_new_id = reference_person_id then
      raise exception 'Нельзя создать супружескую связь человека с самим собой';
    end if;

    if exists (
      select 1
      from public.relationships r
      where r.relationship_type = 'spouse'
        and (
          (r.person1_id = reference_person_id and r.person2_id = v_new_id)
          or (r.person1_id = v_new_id and r.person2_id = reference_person_id)
        )
    ) then
      raise exception 'Супружеская связь уже существует';
    end if;

    insert into public.relationships (person1_id, person2_id, relationship_type)
    values (reference_person_id, v_new_id, 'spouse');

  elsif relation_kind = 'child' then
    if second_parent_id is not null then
      if second_parent_id = reference_person_id then
        raise exception 'Второй родитель не может совпадать с выбранным человеком';
      end if;

      select exists (
        select 1
        from public.relationships r
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

    insert into public.relationships (person1_id, person2_id, relationship_type)
    values (reference_person_id, v_new_id, 'parent');

    if second_parent_id is not null then
      insert into public.relationships (person1_id, person2_id, relationship_type)
      values (second_parent_id, v_new_id, 'parent');
    end if;

  elsif relation_kind = 'sibling' then
    if not exists (
      select 1
      from public.relationships r
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
      insert into public.relationships (person1_id, person2_id, relationship_type)
      values (v_parent_id, v_new_id, 'parent');
    end loop;
  end if;

  return v_new_id;
end;
$$;

revoke all on function public.create_relative(uuid, text, jsonb, uuid) from public;
grant execute on function public.create_relative(uuid, text, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Realtime publication (idempotent)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'people'
  ) then
    execute 'alter publication supabase_realtime add table public.people';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'relationships'
  ) then
    execute 'alter publication supabase_realtime add table public.relationships';
  end if;
end $$;
