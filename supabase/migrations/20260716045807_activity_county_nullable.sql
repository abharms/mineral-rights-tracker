-- Real activity records can carry coordinates but no county string (observed in
-- OCC HF_LATERALS — some laterals have a blank county). Such wells should still
-- plot on the map via their coordinates; they simply won't participate in
-- county-level ownership matching until the county is derived (future: spatial
-- join to county polygons, or from PLSS section/township/range). So county must
-- be nullable in the unified table.
alter table public.activity alter column county drop not null;
