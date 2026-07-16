-- Adds bottom-hole location + lateral trace to the unified activity table, and
-- a raw staging table for Oklahoma's HF_LATERALS directional source.
-- See SPEC.md "Well locations & horizontal/directional data" and the OK
-- "Confirmed layers" note.

-- ---------------------------------------------------------------------------
-- 1. Unified activity: bottom-hole point + lateral trace (all WGS84 / 4326).
--    Map renders a LINE when `path` is present, a POINT (existing `location`)
--    otherwise. bhl_* / path are null for vertical wells.
-- ---------------------------------------------------------------------------
alter table public.activity
  add column bhl_latitude double precision,
  add column bhl_longitude double precision,
  add column path geography(linestring, 4326);

create index activity_path_gix on public.activity using gist (path);

-- ---------------------------------------------------------------------------
-- 2. Raw staging for OK HF_LATERALS (OCC ArcGIS layer 95, "All_Notices_Trace").
--    ~8,500 hydraulically-fractured horizontal laterals with SHL + BHL and a
--    multi-vertex polyline trace. Full-refreshed each run (small layer), so
--    `oid` (ArcGIS object id) is a fine primary key.
-- ---------------------------------------------------------------------------
create table public.raw_ok_laterals (
  oid bigint primary key,                 -- ArcGIS object id
  api text,
  well_name text,
  operator_name text,
  operator_number text,
  county text,
  shl_latitude double precision,
  shl_longitude double precision,
  bhl_latitude double precision,
  bhl_longitude double precision,
  source_datum text,                      -- attribute datum (often NAD27); geometry served as 4326
  section integer,
  township text,
  rng text,                               -- "range" is a reserved word; store as rng
  meridian text,
  service_company text,
  submitted_date date,
  start_date date,
  end_date date,
  flow_date date,
  formation text,
  stages integer,
  path geography(linestring, 4326),       -- the lateral trace, from the polyline geometry
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create index raw_ok_laterals_api_idx on public.raw_ok_laterals (api);

alter table public.raw_ok_laterals enable row level security;

create policy "raw_ok_laterals: authenticated can read"
  on public.raw_ok_laterals for select to authenticated using (true);
