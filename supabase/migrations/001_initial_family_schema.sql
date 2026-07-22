-- Family Tree: initial schema
-- Safe to run in Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  middle_name text,
  last_name text,
  maiden_name text,
  gender text check (gender is null or gender in ('male', 'female', 'other', 'unknown')),
  birth_date date,
  birth_year integer,
  death_date date,
  death_year integer,
  birth_place text,
  biography text,
  photo_url text,
  is_living boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  person1_id uuid not null references public.people (id) on delete cascade,
  person2_id uuid not null references public.people (id) on delete cascade,
  relationship_type text not null check (relationship_type in ('parent', 'spouse')),
  created_at timestamptz not null default now(),
  constraint relationships_no_self_link check (person1_id <> person2_id)
);

create index if not exists relationships_person1_id_idx
  on public.relationships (person1_id);

create index if not exists relationships_person2_id_idx
  on public.relationships (person2_id);

create index if not exists relationships_relationship_type_idx
  on public.relationships (relationship_type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists people_set_updated_at on public.people;
create trigger people_set_updated_at
before update on public.people
for each row
execute function public.set_updated_at();

alter table public.people enable row level security;
alter table public.relationships enable row level security;

drop policy if exists "Public read people" on public.people;
create policy "Public read people"
on public.people
for select
to anon, authenticated
using (true);

drop policy if exists "Public read relationships" on public.relationships;
create policy "Public read relationships"
on public.relationships
for select
to anon, authenticated
using (true);

-- Writes are intentionally not allowed from the client at this stage.
