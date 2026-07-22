-- Family Tree: person photos (private Storage paths + admin RPCs)
-- Safe to re-run in Supabase SQL Editor
--
-- BEFORE running this migration:
-- 1. Create private Storage bucket `person-photos` in Dashboard
--    (Public = false, max 4 MB, MIME: image/webp, image/jpeg, image/png)
-- 2. See PHOTO_STORAGE_SETUP.md
--
-- Does NOT delete existing people.photo_url (legacy compatibility).
-- Does NOT store signed URLs in the database.

-- ---------------------------------------------------------------------------
-- 1. Columns on people
-- ---------------------------------------------------------------------------

alter table public.people
  add column if not exists photo_path text;

alter table public.people
  add column if not exists photo_updated_at timestamptz;

comment on column public.people.photo_path is
  'Relative path inside private bucket person-photos. Never a signed URL.';
comment on column public.people.photo_updated_at is
  'Timestamp of last successful photo_path change.';

-- Drop and recreate CHECK so re-runs stay idempotent.
alter table public.people
  drop constraint if exists people_photo_path_format_check;

alter table public.people
  add constraint people_photo_path_format_check
  check (
    photo_path is null
    or (
      photo_path !~ '\.\.'
      and photo_path !~ '[\\]'
      and photo_path !~* '^https?://'
      and photo_path ~* '^people/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Path validation helper
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_person_photo_path(
  p_path text,
  p_person_id uuid default null
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

  if p_path !~* '^people/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$' then
    return false;
  end if;

  if p_person_id is not null then
    if lower(split_part(p_path, '/', 2)) <> lower(p_person_id::text) then
      return false;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.is_valid_person_photo_path(text, uuid) from public;
grant execute on function public.is_valid_person_photo_path(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Storage policies for bucket person-photos
-- ---------------------------------------------------------------------------

drop policy if exists "person_photos_select_authenticated" on storage.objects;
drop policy if exists "person_photos_insert_admin" on storage.objects;
drop policy if exists "person_photos_delete_admin" on storage.objects;

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
  and public.is_admin()
  and public.is_valid_person_photo_path(name, null)
);

create policy "person_photos_delete_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'person-photos'
  and public.is_admin()
  and public.is_valid_person_photo_path(name, null)
);

-- UPDATE intentionally omitted — photo files are immutable.

-- ---------------------------------------------------------------------------
-- 4. set_person_photo
-- ---------------------------------------------------------------------------

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

  if not public.is_admin() then
    raise exception 'Изменять фотографии может только администратор';
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

-- ---------------------------------------------------------------------------
-- 5. clear_person_photo
-- ---------------------------------------------------------------------------

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

  if not public.is_admin() then
    raise exception 'Изменять фотографии может только администратор';
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
-- 6. delete_person — also return deleted_photo_path
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
  v_photo_path text;
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

  select photo_path into v_photo_path
  from public.people
  where id = target_person_id;

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
    'deleted_relationships_count', v_rel_count,
    'deleted_photo_path', v_photo_path
  );
end;
$$;

revoke all on function public.delete_person(uuid) from public;
grant execute on function public.delete_person(uuid) to authenticated;
