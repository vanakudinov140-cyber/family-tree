-- =============================================================================
-- Manual cleanup: remove ONLY the obsolete test person stub
--
-- Match keys (do NOT use FIO alone):
--   id           = 77777777-7777-4777-8777-777777777777
--   external_key = demid-tretyakov
--
-- SAFE: never deletes rows whose external_key is the real imported child key
--   demid-ivanovich-kudinov-2019
--
-- Idempotent: safe to re-run if the row is already gone.
-- Does NOT change schema / migrations.
-- Run manually in Supabase SQL Editor when needed — do not auto-apply.
--
-- Designed for the SQL Editor: no TEMP TABLE (each statement is self-contained).
-- Run the preview SELECTs first, then the DELETEs, then the verification SELECT.
-- Prefer wrapping deletes in an explicit transaction in the editor if available.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Preview: matched test person (0 rows = already removed)
-- ---------------------------------------------------------------------------
select
  p.id,
  p.external_key,
  p.first_name,
  p.middle_name,
  p.last_name,
  p.birth_date,
  p.birth_place,
  p.photo_path,
  p.data_status
from public.people p
where (
    p.id = '77777777-7777-4777-8777-777777777777'::uuid
    or p.external_key = 'demid-tretyakov'
  )
  and p.external_key is distinct from 'demid-ivanovich-kudinov-2019';

-- Preview related relationships
select
  r.id as relationship_id,
  r.person1_id,
  r.person2_id,
  r.relationship_type,
  r.parent_kind,
  r.spouse_status,
  r.external_key
from public.relationships r
where r.person1_id in (
    select p.id
    from public.people p
    where (
        p.id = '77777777-7777-4777-8777-777777777777'::uuid
        or p.external_key = 'demid-tretyakov'
      )
      and p.external_key is distinct from 'demid-ivanovich-kudinov-2019'
  )
   or r.person2_id in (
    select p.id
    from public.people p
    where (
        p.id = '77777777-7777-4777-8777-777777777777'::uuid
        or p.external_key = 'demid-tretyakov'
      )
      and p.external_key is distinct from 'demid-ivanovich-kudinov-2019'
  );

-- ---------------------------------------------------------------------------
-- 2) Delete relationships where the test person is either side
-- ---------------------------------------------------------------------------
delete from public.relationships r
where r.person1_id in (
    select p.id
    from public.people p
    where (
        p.id = '77777777-7777-4777-8777-777777777777'::uuid
        or p.external_key = 'demid-tretyakov'
      )
      and p.external_key is distinct from 'demid-ivanovich-kudinov-2019'
  )
   or r.person2_id in (
    select p.id
    from public.people p
    where (
        p.id = '77777777-7777-4777-8777-777777777777'::uuid
        or p.external_key = 'demid-tretyakov'
      )
      and p.external_key is distinct from 'demid-ivanovich-kudinov-2019'
  );

-- ---------------------------------------------------------------------------
-- 3) Delete the test person row itself
-- ---------------------------------------------------------------------------
delete from public.people p
where (
    p.id = '77777777-7777-4777-8777-777777777777'::uuid
    or p.external_key = 'demid-tretyakov'
  )
  and p.external_key is distinct from 'demid-ivanovich-kudinov-2019';

-- ---------------------------------------------------------------------------
-- 4) Verification
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.people p
   where p.id = '77777777-7777-4777-8777-777777777777'::uuid
      or p.external_key = 'demid-tretyakov') as remaining_test_rows,
  (select count(*) from public.people p
   where p.external_key = 'demid-ivanovich-kudinov-2019') as remaining_protected_import_key;
