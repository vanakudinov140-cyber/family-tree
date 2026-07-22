-- =============================================================================
-- EXAMPLE seed only — fictional demo people for local / empty projects.
-- Do NOT put real relatives, emails, or production UUIDs here.
-- Copy to seed.sql locally if you need it (seed.sql is gitignored).
-- Never run this against a production database that already has real family data.
-- =============================================================================

-- People (all fictional)
insert into public.people (
  id, first_name, middle_name, last_name, gender,
  birth_date, birth_year, death_date, death_year,
  birth_place, biography, is_living
) values (
  '11111111-1111-4111-8111-111111111111',
  'Алексей',
  'Петрович',
  'Примернов',
  'male',
  '1945-03-12',
  1945,
  '2018-11-04',
  2018,
  'г. Примерск',
  'Вымышленный персонаж для демонстрации схемы и дерева.',
  false
) on conflict (id) do nothing;

insert into public.people (
  id, first_name, middle_name, last_name, gender,
  birth_date, birth_year, birth_place, biography, is_living
) values (
  '22222222-2222-4222-8222-222222222222',
  'Мария',
  'Ивановна',
  'Примернова',
  'female',
  '1948-07-22',
  1948,
  'г. Примерск',
  'Вымышленный персонаж для демонстрации схемы и дерева.',
  true
) on conflict (id) do nothing;

insert into public.people (
  id, first_name, middle_name, last_name, gender,
  birth_date, birth_year, birth_place, biography, is_living
) values (
  '33333333-3333-4333-8333-333333333333',
  'Сергей',
  'Алексеевич',
  'Примернов',
  'male',
  '1972-05-18',
  1972,
  'г. Примерск',
  'Вымышленный персонаж для демонстрации схемы и дерева.',
  true
) on conflict (id) do nothing;

insert into public.people (
  id, first_name, middle_name, last_name, gender,
  birth_date, birth_year, birth_place, biography, is_living
) values (
  '44444444-4444-4444-8444-444444444444',
  'Анна',
  'Сергеевна',
  'Примернова',
  'female',
  '1974-09-03',
  1974,
  'г. Примерск',
  'Вымышленный персонаж для демонстрации схемы и дерева.',
  true
) on conflict (id) do nothing;

insert into public.people (
  id, first_name, middle_name, last_name, gender,
  birth_date, birth_year, birth_place, biography, is_living
) values (
  '55555555-5555-4555-8555-555555555555',
  'Ольга',
  'Алексеевна',
  'Примернова',
  'female',
  '1975-12-01',
  1975,
  'г. Примерск',
  'Вымышленный персонаж для демонстрации схемы и дерева.',
  true
) on conflict (id) do nothing;

insert into public.people (
  id, first_name, middle_name, last_name, gender,
  birth_date, birth_year, birth_place, biography, is_living
) values (
  '66666666-6666-4666-8666-666666666666',
  'Павел',
  'Алексеевич',
  'Примернов',
  'male',
  '1978-02-14',
  1978,
  'г. Примерск',
  'Вымышленный персонаж для демонстрации схемы и дерева.',
  true
) on conflict (id) do nothing;

-- Relationships
insert into public.relationships (id, person1_id, person2_id, relationship_type) values
  (
    'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'spouse'
  ),
  (
    'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    'spouse'
  )
on conflict (id) do nothing;

insert into public.relationships (id, person1_id, person2_id, relationship_type) values
  (
    'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'parent'
  ),
  (
    'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    'parent'
  ),
  (
    'bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'parent'
  ),
  (
    'bbbbbbb4-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
    '22222222-2222-4222-8222-222222222222',
    '55555555-5555-4555-8555-555555555555',
    'parent'
  ),
  (
    'bbbbbbb5-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666666',
    'parent'
  ),
  (
    'bbbbbbb6-bbbb-4bbb-8bbb-bbbbbbbbbbb6',
    '22222222-2222-4222-8222-222222222222',
    '66666666-6666-4666-8666-666666666666',
    'parent'
  )
on conflict (id) do nothing;
