-- Family Tree: update_person and delete_person RPCs
-- Safe to re-run in Supabase SQL Editor
--
-- ВАЖНО: delete_person выполняет физическое удаление человека и его связей.
-- Отменить операцию без резервной копии нельзя.

-- ---------------------------------------------------------------------------
-- 1. update_person
-- ---------------------------------------------------------------------------

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

  if not public.is_admin() then
    raise exception 'Редактировать родственников может только администратор';
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

-- ---------------------------------------------------------------------------
-- 2. delete_person
-- Физическое удаление. Без резервной копии восстановление невозможно.
-- ---------------------------------------------------------------------------

create or replace function public.delete_person(
  target_person_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_people_count integer;
  v_rel_count integer;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if not public.is_admin() then
    raise exception 'Удалять родственников может только администратор';
  end if;

  if target_person_id is null then
    raise exception 'Не указан человек для удаления';
  end if;

  select exists (
    select 1 from public.people where id = target_person_id
  ) into v_exists;

  if not v_exists then
    raise exception 'Человек не найден';
  end if;

  select count(*)::integer into v_people_count from public.people;

  if v_people_count <= 1 then
    raise exception 'Нельзя удалить единственного человека в дереве';
  end if;

  select count(*)::integer
  into v_rel_count
  from public.relationships
  where person1_id = target_person_id
     or person2_id = target_person_id;

  delete from public.relationships
  where person1_id = target_person_id
     or person2_id = target_person_id;

  delete from public.people
  where id = target_person_id;

  return jsonb_build_object(
    'deleted_person_id', target_person_id,
    'deleted_relationships_count', v_rel_count
  );
end;
$$;

revoke all on function public.delete_person(uuid) from public;
grant execute on function public.delete_person(uuid) to authenticated;
