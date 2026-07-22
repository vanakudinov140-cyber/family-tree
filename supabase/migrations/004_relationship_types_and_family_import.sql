-- Family Tree: extended relationship metadata + family import RPCs
-- Safe to re-run in Supabase SQL Editor
-- Does not delete existing people/relationships

-- ---------------------------------------------------------------------------
-- 1. people: external_key, data_status, notes
-- ---------------------------------------------------------------------------

alter table public.people
  add column if not exists external_key text;

alter table public.people
  add column if not exists data_status text;

alter table public.people
  add column if not exists notes text;

update public.people
set data_status = 'confirmed'
where data_status is null;

alter table public.people
  alter column data_status set default 'confirmed';

alter table public.people
  alter column data_status set not null;

alter table public.people
  drop constraint if exists people_data_status_check;

alter table public.people
  add constraint people_data_status_check
  check (data_status in ('confirmed', 'needs_review', 'test'));

create unique index if not exists people_external_key_unique
  on public.people (external_key)
  where external_key is not null;

-- ---------------------------------------------------------------------------
-- 2. relationships: extended fields
-- ---------------------------------------------------------------------------

alter table public.relationships
  add column if not exists external_key text;

alter table public.relationships
  add column if not exists parent_kind text;

alter table public.relationships
  add column if not exists spouse_status text;

alter table public.relationships
  add column if not exists confidence text;

alter table public.relationships
  add column if not exists notes text;

update public.relationships
set parent_kind = 'biological'
where relationship_type = 'parent'
  and parent_kind is null;

update public.relationships
set spouse_status = 'unknown'
where relationship_type = 'spouse'
  and spouse_status is null;

update public.relationships
set confidence = 'confirmed'
where confidence is null;

alter table public.relationships
  alter column confidence set default 'confirmed';

alter table public.relationships
  alter column confidence set not null;

alter table public.relationships
  drop constraint if exists relationships_parent_kind_check;

alter table public.relationships
  add constraint relationships_parent_kind_check
  check (
    parent_kind is null
    or parent_kind in ('biological', 'adoptive', 'step', 'guardian')
  );

alter table public.relationships
  drop constraint if exists relationships_spouse_status_check;

alter table public.relationships
  add constraint relationships_spouse_status_check
  check (
    spouse_status is null
    or spouse_status in ('current', 'former', 'unknown')
  );

alter table public.relationships
  drop constraint if exists relationships_confidence_check;

alter table public.relationships
  add constraint relationships_confidence_check
  check (confidence in ('confirmed', 'probable', 'uncertain'));

alter table public.relationships
  drop constraint if exists relationships_type_fields_check;

alter table public.relationships
  add constraint relationships_type_fields_check
  check (
    (
      relationship_type = 'parent'
      and parent_kind is not null
      and spouse_status is null
    )
    or (
      relationship_type = 'spouse'
      and spouse_status is not null
      and parent_kind is null
    )
  );

create unique index if not exists relationships_external_key_unique
  on public.relationships (external_key)
  where external_key is not null;

-- ---------------------------------------------------------------------------
-- 3. Patch create_relative to fill new columns
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
-- ---------------------------------------------------------------------------
-- 4. validate_family_import (read-only)
-- ---------------------------------------------------------------------------

create or replace function public.validate_family_import(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
  v_people jsonb;
  v_rels jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_duplicate_keys jsonb := '[]'::jsonb;
  v_unresolved jsonb := '[]'::jsonb;
  v_keys text[] := '{}';
  v_rel_keys text[] := '{}';
  v_key text;
  v_rel_key text;
  v_person jsonb;
  v_rel jsonb;
  v_i integer;
  v_j integer;
  v_first_name text;
  v_gender text;
  v_birth_date date;
  v_death_date date;
  v_birth_year integer;
  v_death_year integer;
  v_data_status text;
  v_type text;
  v_p1 text;
  v_p2 text;
  v_parent_kind text;
  v_spouse_status text;
  v_confidence text;
  v_new_people integer := 0;
  v_existing_people integer := 0;
  v_new_rels integer := 0;
  v_existing_rels integer := 0;
  v_review integer := 0;
  v_exists boolean;
  v_cycle boolean;
  v_seen text[];
  v_stack text[];
  v_cur text;
  v_child text;
  v_name_a text;
  v_name_b text;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if not public.is_admin() then
    raise exception 'Импорт доступен только администратору';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    return jsonb_build_object(
      'valid', false,
      'errors', jsonb_build_array(jsonb_build_object('code', 'invalid_payload', 'message', 'Некорректный JSON payload')),
      'warnings', '[]'::jsonb,
      'newPeopleCount', 0,
      'existingPeopleCount', 0,
      'newRelationshipsCount', 0,
      'existingRelationshipsCount', 0,
      'unresolvedKeys', '[]'::jsonb,
      'duplicateKeys', '[]'::jsonb,
      'reviewRequiredCount', 0
    );
  end if;

  begin
    v_version := (payload ->> 'version')::integer;
  exception when others then
    v_version := null;
  end;

  if v_version is distinct from 1 then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'invalid_version',
      'message', 'Поддерживается только version = 1'
    ));
  end if;

  v_people := coalesce(payload -> 'people', '[]'::jsonb);
  v_rels := coalesce(payload -> 'relationships', '[]'::jsonb);

  if jsonb_typeof(v_people) <> 'array' or jsonb_typeof(v_rels) <> 'array' then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'invalid_arrays',
      'message', 'people и relationships должны быть массивами'
    ));
  end if;

  for v_i in 0 .. greatest(jsonb_array_length(v_people) - 1, -1) loop
    v_person := v_people -> v_i;
    v_key := nullif(trim(coalesce(v_person ->> 'key', '')), '');

    if v_key is null then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'missing_person_key',
        'message', format('У человека #%s отсутствует key', v_i + 1)
      ));
      continue;
    end if;

    if v_key = any(v_keys) then
      v_duplicate_keys := v_duplicate_keys || to_jsonb(v_key);
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'duplicate_person_key',
        'message', format('Дублирующий key человека: %s', v_key),
        'key', v_key
      ));
    else
      v_keys := array_append(v_keys, v_key);
    end if;

    v_first_name := nullif(trim(coalesce(v_person ->> 'firstName', v_person ->> 'first_name', '')), '');
    if v_first_name is null then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'missing_first_name',
        'message', format('Имя обязательно для %s', v_key),
        'key', v_key
      ));
    end if;

    v_gender := nullif(trim(coalesce(v_person ->> 'gender', '')), '');
    if v_gender is null or v_gender not in ('male', 'female', 'other', 'unknown') then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_gender',
        'message', format('Некорректный пол у %s', v_key),
        'key', v_key
      ));
    end if;

    v_data_status := coalesce(nullif(trim(coalesce(v_person ->> 'dataStatus', v_person ->> 'data_status', '')), ''), 'confirmed');
    if v_data_status not in ('confirmed', 'needs_review', 'test') then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_data_status',
        'message', format('Некорректный dataStatus у %s', v_key),
        'key', v_key
      ));
    elsif v_data_status = 'needs_review' then
      v_review := v_review + 1;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'needs_review',
        'message', format('Человек %s требует проверки', v_key),
        'key', v_key
      ));
    end if;

    begin
      v_birth_date := nullif(coalesce(v_person ->> 'birthDate', v_person ->> 'birth_date', ''), '')::date;
    exception when others then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_birth_date', 'message', format('Некорректная дата рождения у %s', v_key), 'key', v_key
      ));
      v_birth_date := null;
    end;

    begin
      v_death_date := nullif(coalesce(v_person ->> 'deathDate', v_person ->> 'death_date', ''), '')::date;
    exception when others then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_death_date', 'message', format('Некорректная дата смерти у %s', v_key), 'key', v_key
      ));
      v_death_date := null;
    end;

    begin
      if nullif(coalesce(v_person ->> 'birthYear', v_person ->> 'birth_year', ''), '') is null then
        v_birth_year := null;
      else
        v_birth_year := coalesce(v_person ->> 'birthYear', v_person ->> 'birth_year')::integer;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_birth_year', 'message', format('Некорректный год рождения у %s', v_key), 'key', v_key
      ));
      v_birth_year := null;
    end;

    begin
      if nullif(coalesce(v_person ->> 'deathYear', v_person ->> 'death_year', ''), '') is null then
        v_death_year := null;
      else
        v_death_year := coalesce(v_person ->> 'deathYear', v_person ->> 'death_year')::integer;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_death_year', 'message', format('Некорректный год смерти у %s', v_key), 'key', v_key
      ));
      v_death_year := null;
    end;

    if v_birth_date is not null and v_death_date is not null and v_death_date < v_birth_date then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'death_before_birth', 'message', format('Дата смерти раньше рождения у %s', v_key), 'key', v_key
      ));
    end if;

    if v_birth_year is not null and v_death_year is not null and v_death_year < v_birth_year then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'death_year_before_birth', 'message', format('Год смерти раньше рождения у %s', v_key), 'key', v_key
      ));
    end if;

    if v_birth_date is not null and v_birth_year is not null
       and extract(year from v_birth_date)::integer <> v_birth_year then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'birth_year_mismatch', 'message', format('Год рождения не совпадает с датой у %s', v_key), 'key', v_key
      ));
    end if;

    if v_death_date is not null and v_death_year is not null
       and extract(year from v_death_date)::integer <> v_death_year then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'death_year_mismatch', 'message', format('Год смерти не совпадает с датой у %s', v_key), 'key', v_key
      ));
    end if;

    -- Reject forbidden fields in insert_only payload
    if v_person ? 'id' or v_person ? 'created_at' or v_person ? 'updated_at' or v_person ? 'photo_url' or v_person ? 'photoUrl' then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'forbidden_fields',
        'message', format('Запрещённые поля у %s (id/created_at/updated_at/photo_url)', v_key),
        'key', v_key
      ));
    end if;

    select exists (
      select 1 from public.people p where p.external_key = v_key
    ) into v_exists;

    if v_exists then
      v_existing_people := v_existing_people + 1;
    else
      v_new_people := v_new_people + 1;

      -- Name collision warning (not auto-merge)
      select p.first_name || ' ' || coalesce(p.last_name, '')
      into v_name_a
      from public.people p
      where lower(p.first_name) = lower(v_first_name)
        and lower(coalesce(p.last_name, '')) = lower(coalesce(nullif(trim(coalesce(v_person ->> 'lastName', v_person ->> 'last_name', '')), ''), ''))
        and p.external_key is distinct from v_key
      limit 1;

      if v_name_a is not null then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code', 'name_collision',
          'message', format('Имя похоже на существующую запись, но external_key другой: %s', v_key),
          'key', v_key
        ));
      end if;
    end if;
  end loop;

  for v_i in 0 .. greatest(jsonb_array_length(v_rels) - 1, -1) loop
    v_rel := v_rels -> v_i;
    v_rel_key := nullif(trim(coalesce(v_rel ->> 'key', '')), '');
    v_type := nullif(trim(coalesce(v_rel ->> 'type', v_rel ->> 'relationship_type', '')), '');
    v_p1 := nullif(trim(coalesce(v_rel ->> 'person1Key', v_rel ->> 'person1_key', '')), '');
    v_p2 := nullif(trim(coalesce(v_rel ->> 'person2Key', v_rel ->> 'person2_key', '')), '');
    v_parent_kind := nullif(trim(coalesce(v_rel ->> 'parentKind', v_rel ->> 'parent_kind', '')), '');
    v_spouse_status := nullif(trim(coalesce(v_rel ->> 'spouseStatus', v_rel ->> 'spouse_status', '')), '');
    v_confidence := coalesce(nullif(trim(coalesce(v_rel ->> 'confidence', '')), ''), 'confirmed');

    if v_rel_key is null then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'missing_relationship_key',
        'message', format('У связи #%s отсутствует key', v_i + 1)
      ));
      continue;
    end if;

    if v_rel_key = any(v_rel_keys) then
      v_duplicate_keys := v_duplicate_keys || to_jsonb(v_rel_key);
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'duplicate_relationship_key',
        'message', format('Дублирующий key связи: %s', v_rel_key),
        'key', v_rel_key
      ));
    else
      v_rel_keys := array_append(v_rel_keys, v_rel_key);
    end if;

    if v_type is null or v_type not in ('parent', 'spouse') then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_relationship_type',
        'message', format('Некорректный type у связи %s', v_rel_key),
        'key', v_rel_key
      ));
      continue;
    end if;

    if v_p1 is null or v_p2 is null then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'missing_relationship_people',
        'message', format('У связи %s не указаны person1Key/person2Key', v_rel_key),
        'key', v_rel_key
      ));
      continue;
    end if;

    if v_p1 = v_p2 then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'self_link',
        'message', format('Нельзя связать человека с самим собой: %s', v_rel_key),
        'key', v_rel_key
      ));
    end if;

    if not (v_p1 = any(v_keys)) and not exists (select 1 from public.people p where p.external_key = v_p1) then
      v_unresolved := v_unresolved || to_jsonb(v_p1);
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'unresolved_person_key',
        'message', format('Неизвестный person1Key: %s', v_p1),
        'key', v_p1
      ));
    end if;

    if not (v_p2 = any(v_keys)) and not exists (select 1 from public.people p where p.external_key = v_p2) then
      v_unresolved := v_unresolved || to_jsonb(v_p2);
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'unresolved_person_key',
        'message', format('Неизвестный person2Key: %s', v_p2),
        'key', v_p2
      ));
    end if;

    if v_type = 'parent' then
      if v_parent_kind is null or v_parent_kind not in ('biological', 'adoptive', 'step', 'guardian') then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'code', 'missing_parent_kind',
          'message', format('Для parent-связи %s нужен parentKind', v_rel_key),
          'key', v_rel_key
        ));
      end if;
      if v_spouse_status is not null then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'code', 'spouse_status_on_parent',
          'message', format('spouseStatus недопустим для parent-связи %s', v_rel_key),
          'key', v_rel_key
        ));
      end if;
      if v_parent_kind = 'step' then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code', 'step_parent',
          'message', format('Отчим/мачеха %s не считается биологическим родителем', v_rel_key),
          'key', v_rel_key
        ));
      end if;
    end if;

    if v_type = 'spouse' then
      if v_spouse_status is null or v_spouse_status not in ('current', 'former', 'unknown') then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'code', 'missing_spouse_status',
          'message', format('Для spouse-связи %s нужен spouseStatus', v_rel_key),
          'key', v_rel_key
        ));
      end if;
      if v_parent_kind is not null then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'code', 'parent_kind_on_spouse',
          'message', format('parentKind недопустим для spouse-связи %s', v_rel_key),
          'key', v_rel_key
        ));
      end if;
    end if;

    if v_confidence not in ('confirmed', 'probable', 'uncertain') then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_confidence',
        'message', format('Некорректный confidence у %s', v_rel_key),
        'key', v_rel_key
      ));
    elsif v_confidence in ('probable', 'uncertain') then
      v_review := v_review + 1;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'uncertain_relationship',
        'message', format('Связь %s имеет confidence=%s', v_rel_key, v_confidence),
        'key', v_rel_key
      ));
    end if;

    select exists (
      select 1 from public.relationships r where r.external_key = v_rel_key
    ) into v_exists;

    if v_exists then
      v_existing_rels := v_existing_rels + 1;
    else
      v_new_rels := v_new_rels + 1;
    end if;

    -- Reverse spouse duplicate warning inside payload
    if v_type = 'spouse' then
      for v_j in 0 .. greatest(jsonb_array_length(v_rels) - 1, -1) loop
        if v_j = v_i then
          continue;
        end if;
        if (v_rels -> v_j ->> 'type') = 'spouse'
           and (
             (
               coalesce(v_rels -> v_j ->> 'person1Key', v_rels -> v_j ->> 'person1_key') = v_p2
               and coalesce(v_rels -> v_j ->> 'person2Key', v_rels -> v_j ->> 'person2_key') = v_p1
             )
           ) then
          v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
            'code', 'reverse_spouse_duplicate',
            'message', format('Возможен дубль spouse в обратном порядке: %s', v_rel_key),
            'key', v_rel_key
          ));
        end if;
      end loop;
    end if;
  end loop;

  -- Parent cycles among payload parent edges (keys only)
  -- Build adjacency: child -> parents via reverse of parent edges (person1 parent of person2)
  for v_i in 0 .. greatest(jsonb_array_length(v_rels) - 1, -1) loop
    v_rel := v_rels -> v_i;
    if coalesce(v_rel ->> 'type', '') <> 'parent' then
      continue;
    end if;
    v_p1 := nullif(trim(coalesce(v_rel ->> 'person1Key', '')), ''); -- parent
    v_p2 := nullif(trim(coalesce(v_rel ->> 'person2Key', '')), ''); -- child
    if v_p1 is null or v_p2 is null then
      continue;
    end if;
    if v_p1 = v_p2 then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'self_parent',
        'message', format('Человек не может быть собственным родителем: %s', v_p1),
        'key', v_p1
      ));
    end if;
  end loop;

  -- DFS cycle detection on payload parent graph
  for v_i in 0 .. coalesce(array_length(v_keys, 1), 0) - 1 loop
    v_stack := array[v_keys[v_i + 1]];
    v_seen := '{}';
    v_cycle := false;

    while array_length(v_stack, 1) is not null loop
      v_cur := v_stack[array_length(v_stack, 1)];
      v_stack := v_stack[1:array_length(v_stack, 1) - 1];

      if v_cur = any(v_seen) then
        continue;
      end if;
      v_seen := array_append(v_seen, v_cur);

      for v_j in 0 .. greatest(jsonb_array_length(v_rels) - 1, -1) loop
        v_rel := v_rels -> v_j;
        if coalesce(v_rel ->> 'type', '') <> 'parent' then
          continue;
        end if;
        -- parent of v_cur is person1 when person2 = v_cur; walk up to detect cycle back
        if coalesce(v_rel ->> 'person2Key', '') = v_cur then
          v_child := coalesce(v_rel ->> 'person1Key', '');
          if v_child = v_keys[v_i + 1] then
            v_cycle := true;
            exit;
          end if;
          if v_child <> '' and not (v_child = any(v_seen)) then
            v_stack := array_append(v_stack, v_child);
          end if;
        end if;
      end loop;

      exit when v_cycle;
    end loop;

    if v_cycle then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'code', 'parent_cycle',
        'message', format('Обнаружен родительский цикл с участием %s', v_keys[v_i + 1]),
        'key', v_keys[v_i + 1]
      ));
      exit;
    end if;
  end loop;

  return jsonb_build_object(
    'valid', jsonb_array_length(v_errors) = 0,
    'errors', v_errors,
    'warnings', v_warnings,
    'newPeopleCount', v_new_people,
    'existingPeopleCount', v_existing_people,
    'newRelationshipsCount', v_new_rels,
    'existingRelationshipsCount', v_existing_rels,
    'unresolvedKeys', (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(v_unresolved) x),
    'duplicateKeys', (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(v_duplicate_keys) x),
    'reviewRequiredCount', v_review
  );
end;
$$;

revoke all on function public.validate_family_import(jsonb) from public;
grant execute on function public.validate_family_import(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. import_family_batch (insert_only, atomic)
-- ---------------------------------------------------------------------------

create or replace function public.import_family_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report jsonb;
  v_people jsonb;
  v_rels jsonb;
  v_i integer;
  v_person jsonb;
  v_rel jsonb;
  v_key text;
  v_id uuid;
  v_p1_id uuid;
  v_p2_id uuid;
  v_type text;
  v_parent_kind text;
  v_spouse_status text;
  v_confidence text;
  v_exists boolean;
  v_inserted_people jsonb := '[]'::jsonb;
  v_skipped_people jsonb := '[]'::jsonb;
  v_inserted_rels jsonb := '[]'::jsonb;
  v_skipped_rels jsonb := '[]'::jsonb;
  v_imported_ids jsonb := '[]'::jsonb;
  v_map jsonb := '{}'::jsonb;
  v_first_name text;
  v_middle_name text;
  v_last_name text;
  v_maiden_name text;
  v_gender text;
  v_birth_date date;
  v_death_date date;
  v_birth_year integer;
  v_death_year integer;
  v_birth_place text;
  v_biography text;
  v_is_living boolean;
  v_data_status text;
  v_notes text;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if not public.is_admin() then
    raise exception 'Импорт доступен только администратору';
  end if;

  v_report := public.validate_family_import(payload);

  if coalesce((v_report ->> 'valid')::boolean, false) is not true then
    raise exception 'Импорт отклонён: файл не прошёл валидацию';
  end if;

  v_people := coalesce(payload -> 'people', '[]'::jsonb);
  v_rels := coalesce(payload -> 'relationships', '[]'::jsonb);

  -- Resolve existing keys into map
  for v_i in 0 .. greatest(jsonb_array_length(v_people) - 1, -1) loop
    v_person := v_people -> v_i;
    v_key := trim(v_person ->> 'key');

    select p.id into v_id
    from public.people p
    where p.external_key = v_key
    limit 1;

    if v_id is not null then
      v_map := v_map || jsonb_build_object(v_key, v_id);
      v_skipped_people := v_skipped_people || jsonb_build_array(jsonb_build_object(
        'key', v_key,
        'id', v_id,
        'reason', 'already_exists'
      ));
      continue;
    end if;

    v_first_name := nullif(trim(coalesce(v_person ->> 'firstName', v_person ->> 'first_name', '')), '');
    v_middle_name := nullif(trim(coalesce(v_person ->> 'middleName', v_person ->> 'middle_name', '')), '');
    v_last_name := nullif(trim(coalesce(v_person ->> 'lastName', v_person ->> 'last_name', '')), '');
    v_maiden_name := nullif(trim(coalesce(v_person ->> 'maidenName', v_person ->> 'maiden_name', '')), '');
    v_gender := nullif(trim(coalesce(v_person ->> 'gender', '')), '');
    v_birth_place := nullif(trim(coalesce(v_person ->> 'birthPlace', v_person ->> 'birth_place', '')), '');
    v_biography := nullif(trim(coalesce(v_person ->> 'biography', '')), '');
    v_notes := nullif(trim(coalesce(v_person ->> 'notes', '')), '');
    v_data_status := coalesce(nullif(trim(coalesce(v_person ->> 'dataStatus', v_person ->> 'data_status', '')), ''), 'confirmed');

    begin
      v_birth_date := nullif(coalesce(v_person ->> 'birthDate', v_person ->> 'birth_date', ''), '')::date;
    exception when others then
      v_birth_date := null;
    end;
    begin
      v_death_date := nullif(coalesce(v_person ->> 'deathDate', v_person ->> 'death_date', ''), '')::date;
    exception when others then
      v_death_date := null;
    end;
    begin
      if nullif(coalesce(v_person ->> 'birthYear', v_person ->> 'birth_year', ''), '') is null then
        v_birth_year := null;
      else
        v_birth_year := coalesce(v_person ->> 'birthYear', v_person ->> 'birth_year')::integer;
      end if;
    exception when others then
      v_birth_year := null;
    end;
    begin
      if nullif(coalesce(v_person ->> 'deathYear', v_person ->> 'death_year', ''), '') is null then
        v_death_year := null;
      else
        v_death_year := coalesce(v_person ->> 'deathYear', v_person ->> 'death_year')::integer;
      end if;
    exception when others then
      v_death_year := null;
    end;

    if v_death_date is not null or v_death_year is not null then
      v_is_living := false;
    elsif v_person ? 'isLiving' or v_person ? 'is_living' then
      v_is_living := coalesce((coalesce(v_person ->> 'isLiving', v_person ->> 'is_living'))::boolean, true);
    else
      v_is_living := true;
    end if;

    insert into public.people (
      first_name, middle_name, last_name, maiden_name, gender,
      birth_date, birth_year, death_date, death_year,
      birth_place, biography, is_living, external_key, data_status, notes
    ) values (
      v_first_name, v_middle_name, v_last_name, v_maiden_name, v_gender,
      v_birth_date,
      coalesce(v_birth_year, case when v_birth_date is not null then extract(year from v_birth_date)::integer end),
      v_death_date,
      coalesce(v_death_year, case when v_death_date is not null then extract(year from v_death_date)::integer end),
      v_birth_place, v_biography, v_is_living, v_key, v_data_status, v_notes
    )
    returning id into v_id;

    v_map := v_map || jsonb_build_object(v_key, v_id);
    v_inserted_people := v_inserted_people || jsonb_build_array(jsonb_build_object('key', v_key, 'id', v_id));
    v_imported_ids := v_imported_ids || to_jsonb(v_id);
  end loop;

  -- Also map keys that exist only in DB and are referenced
  for v_i in 0 .. greatest(jsonb_array_length(v_rels) - 1, -1) loop
    v_rel := v_rels -> v_i;
    foreach v_key in array array[
      trim(coalesce(v_rel ->> 'person1Key', '')),
      trim(coalesce(v_rel ->> 'person2Key', ''))
    ] loop
      if v_key = '' or v_map ? v_key then
        continue;
      end if;
      select p.id into v_id from public.people p where p.external_key = v_key limit 1;
      if v_id is not null then
        v_map := v_map || jsonb_build_object(v_key, v_id);
      end if;
    end loop;
  end loop;

  for v_i in 0 .. greatest(jsonb_array_length(v_rels) - 1, -1) loop
    v_rel := v_rels -> v_i;
    v_key := trim(v_rel ->> 'key');
    v_type := trim(coalesce(v_rel ->> 'type', ''));
    v_parent_kind := nullif(trim(coalesce(v_rel ->> 'parentKind', '')), '');
    v_spouse_status := nullif(trim(coalesce(v_rel ->> 'spouseStatus', '')), '');
    v_confidence := coalesce(nullif(trim(coalesce(v_rel ->> 'confidence', '')), ''), 'confirmed');
    v_notes := nullif(trim(coalesce(v_rel ->> 'notes', '')), '');

    select exists (
      select 1 from public.relationships r where r.external_key = v_key
    ) into v_exists;

    if v_exists then
      v_skipped_rels := v_skipped_rels || jsonb_build_array(jsonb_build_object(
        'key', v_key,
        'reason', 'already_exists'
      ));
      continue;
    end if;

    v_p1_id := nullif(v_map ->> trim(v_rel ->> 'person1Key'), '')::uuid;
    v_p2_id := nullif(v_map ->> trim(v_rel ->> 'person2Key'), '')::uuid;

    if v_p1_id is null or v_p2_id is null then
      raise exception 'Не удалось сопоставить ключи для связи %', v_key;
    end if;

    -- Skip reverse spouse duplicate if forward already exists
    if v_type = 'spouse' and exists (
      select 1 from public.relationships r
      where r.relationship_type = 'spouse'
        and (
          (r.person1_id = v_p1_id and r.person2_id = v_p2_id)
          or (r.person1_id = v_p2_id and r.person2_id = v_p1_id)
        )
    ) then
      v_skipped_rels := v_skipped_rels || jsonb_build_array(jsonb_build_object(
        'key', v_key,
        'reason', 'reverse_or_existing_spouse'
      ));
      continue;
    end if;

    if v_type = 'parent' and exists (
      select 1 from public.relationships r
      where r.relationship_type = 'parent'
        and r.person1_id = v_p1_id
        and r.person2_id = v_p2_id
    ) then
      v_skipped_rels := v_skipped_rels || jsonb_build_array(jsonb_build_object(
        'key', v_key,
        'reason', 'existing_parent_link'
      ));
      continue;
    end if;

    insert into public.relationships (
      person1_id, person2_id, relationship_type,
      parent_kind, spouse_status, confidence, external_key, notes
    ) values (
      v_p1_id, v_p2_id, v_type,
      case when v_type = 'parent' then v_parent_kind else null end,
      case when v_type = 'spouse' then v_spouse_status else null end,
      v_confidence, v_key, v_notes
    );

    v_inserted_rels := v_inserted_rels || jsonb_build_array(jsonb_build_object('key', v_key));
  end loop;

  return jsonb_build_object(
    'insertedPeople', v_inserted_people,
    'skippedPeople', v_skipped_people,
    'insertedRelationships', v_inserted_rels,
    'skippedRelationships', v_skipped_rels,
    'warnings', coalesce(v_report -> 'warnings', '[]'::jsonb),
    'importedPersonIds', v_imported_ids,
    'mode', 'insert_only'
  );
end;
$$;

revoke all on function public.import_family_batch(jsonb) from public;
grant execute on function public.import_family_batch(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Notes on immutability
-- ---------------------------------------------------------------------------
-- public.update_person (migration 003) does not read external_key.
-- The edit form also does not expose external_key, so import keys stay stable.
-- data_status / relationship parent_kind / spouse_status are managed via import
-- and future admin tools; existing create_relative fills safe defaults.