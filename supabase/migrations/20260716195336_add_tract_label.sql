-- User-editable nickname for a tract (e.g. "Home Place", "Grandma's place").
-- Optional: when not provided, the app displays a computed fallback like
-- "{County} County Tract" rather than storing a duplicate default value —
-- this keeps the fallback correct even if county is edited later.
alter table public.ownership_tracts add column label text;
