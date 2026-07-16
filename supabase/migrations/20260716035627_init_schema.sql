-- Initial schema: profiles, ownership tracts, per-state raw staging, and the
-- unified activity table. Matches the architecture in STRATEGY.md:
--   [state adapters] -> [raw staging] -> [normalization] -> [unified activity]
-- Matching engine / alerts tables are Tier 2 and are added when we build that phase.

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users, holds subscription/tier state
-- ---------------------------------------------------------------------------
create type subscription_tier as enum ('trial', 'tier1', 'tier2');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  tier subscription_tier not null default 'trial',
  status subscription_status not null default 'trialing',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: user can read own row"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: user can update own row"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- ownership_tracts: self-reported ownership (per SPEC.md / STRATEGY.md)
-- ---------------------------------------------------------------------------
create type interest_type as enum ('mineral', 'royalty', 'npri');

create table public.ownership_tracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  state text not null,
  county text not null,
  county_fips text,
  approx_acres numeric,
  interest_type interest_type not null default 'mineral',
  legal_description text,
  operator text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ownership_tracts_user_id_idx on public.ownership_tracts (user_id);
create index ownership_tracts_state_county_idx on public.ownership_tracts (state, county_fips);

alter table public.ownership_tracts enable row level security;

create policy "ownership_tracts: user can manage own rows"
  on public.ownership_tracts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Raw staging tables: mirror each source's shape as closely as possible.
-- Written only by ingestion jobs (service role); readable by any signed-in
-- user (public regulatory data — the tier paywall is enforced at the app
-- layer via profiles.tier, not by hiding rows here).
-- ---------------------------------------------------------------------------
create table public.raw_ok_wells (
  objectid bigint primary key,
  api_number text,
  well_name text,
  operator_name text,
  well_status text,
  well_type text,
  county text,
  spud_date timestamptz,
  completion_date timestamptz,
  total_depth numeric,
  longitude double precision,
  latitude double precision,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create table public.raw_ok_permits (
  objectid bigint primary key,
  api_number text,
  entity_name text,
  well_name text,
  well_number text,
  application_type text,
  permit_status text,
  county text,
  submit_date timestamptz,
  approval_date timestamptz,
  expire_date timestamptz,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create table public.raw_tx_permits (
  permit_number text primary key,
  county_code text,
  lease_name text,
  well_number text,
  total_depth_ft text,
  application_type text,
  permit_issued_date date,
  spud_date date,
  nearest_city text,
  horizontal_well boolean,
  api_number text,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create table public.raw_tx_wellbore (
  standard_api_number text primary key,
  county_name text,
  lease_name text,
  operator_name text,
  well_status text,
  oil_gas_code text,
  api_depth text,
  completion_date text,
  well_no_display text,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

alter table public.raw_ok_wells enable row level security;
alter table public.raw_ok_permits enable row level security;
alter table public.raw_tx_permits enable row level security;
alter table public.raw_tx_wellbore enable row level security;

create policy "raw_ok_wells: authenticated can read" on public.raw_ok_wells for select to authenticated using (true);
create policy "raw_ok_permits: authenticated can read" on public.raw_ok_permits for select to authenticated using (true);
create policy "raw_tx_permits: authenticated can read" on public.raw_tx_permits for select to authenticated using (true);
create policy "raw_tx_wellbore: authenticated can read" on public.raw_tx_wellbore for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- activity: unified schema (per SPEC.md), fed by the normalization layer.
-- This is what the map and dashboard query.
-- ---------------------------------------------------------------------------
create type activity_record_type as enum ('well', 'permit');

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  county text not null,
  county_fips text,
  api_number text,
  well_name text,
  operator text,
  record_type activity_record_type not null,
  event_date date,
  status text,
  latitude double precision,
  longitude double precision,
  location geography(point, 4326)
    generated always as (
      case
        when longitude is not null and latitude is not null
          then st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
        else null
      end
    ) stored,
  well_type text,
  source_state_agency text not null,
  source_table text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  unique (source_table, source_id)
);

create index activity_state_county_idx on public.activity (state, county_fips);
create index activity_event_date_idx on public.activity (event_date desc);
create index activity_location_gix on public.activity using gist (location);

alter table public.activity enable row level security;

create policy "activity: authenticated can read" on public.activity for select to authenticated using (true);
