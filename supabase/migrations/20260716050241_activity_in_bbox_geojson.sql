-- Viewport-bounded activity query returning a GeoJSON FeatureCollection.
-- This is the scalable map pattern from STRATEGY.md: the client sends the
-- current map bounds, and we return only the activity intersecting that box
-- (never the whole table), capped by max_features.
--
-- SECURITY DEFINER + execute grant to anon/authenticated: `activity` is public
-- regulatory data (the subscription paywall is an app-layer concern, not row
-- secrecy), so exposing a read-only, bounded GeoJSON accessor is intentional.
-- The bbox prefilter uses the geography GiST indexes on path/location.

create or replace function public.activity_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_features integer default 5000
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with box as (
    select st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography as g
  ),
  hits as (
    select
      a.id, a.api_number, a.operator, a.well_name, a.county, a.state,
      a.record_type, a.well_type, a.event_date,
      coalesce(a.path::geometry, a.location::geometry) as geom
    from public.activity a, box
    where (a.path is not null and a.path && box.g)
       or (a.path is null and a.location is not null and a.location && box.g)
    limit max_features
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', st_asgeojson(geom)::jsonb,
        'properties', jsonb_build_object(
          'id', id,
          'api_number', api_number,
          'operator', operator,
          'well_name', well_name,
          'county', county,
          'state', state,
          'record_type', record_type,
          'well_type', well_type,
          'event_date', event_date
        )
      )
    ), '[]'::jsonb)
  )
  from hits;
$$;

grant execute on function public.activity_in_bbox(
  double precision, double precision, double precision, double precision, integer
) to anon, authenticated;
