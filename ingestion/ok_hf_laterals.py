"""
Oklahoma OCC "HF_LATERALS" adapter.

Ingests hydraulically-fractured horizontal well laterals — surface (SHL) and
bottom-hole (BHL) locations plus the lateral trace polyline — from the OCC
ArcGIS REST API into the raw_ok_laterals staging table, then normalizes them
into the unified `activity` table.

Source layer (see SPEC.md "Oklahoma — Confirmed layers"):
  https://gis.occ.ok.gov/server/rest/services/Hosted/HF_LATERALS/FeatureServer/95
  ("All_Notices_Trace") — ~8,500 laterals, all with BHL populated, polyline
  geometry served natively in WGS84 (wkid 4326).

Coverage caveat: this layer covers modern hydraulically-fractured horizontals
that filed OCC completion/seismicity notices — not older conventional
directional wells. Vertical wells are handled separately via COMP_WELLS.

Usage:
  python ok_hf_laterals.py --dry-run 5   # fetch 5, print transformed rows, NO DB / NO secrets
  python ok_hf_laterals.py               # full ingest + normalize (needs SUPABASE_DB_URL)
  python ok_hf_laterals.py --limit 500   # ingest only the first 500 (testing)

DB connection: reads SUPABASE_DB_URL from the environment, or from a gitignored
`ingestion/.env` file (KEY=VALUE lines). Get the string from the Supabase
dashboard -> Project Settings -> Database -> Connection string.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

LAYER_URL = (
    "https://gis.occ.ok.gov/server/rest/services/Hosted/"
    "HF_LATERALS/FeatureServer/95"
)
PAGE_SIZE = 2000
OUT_FIELDS = [
    "oid", "api", "opname", "opnum", "wellname", "county",
    "shl_lat", "shl_long", "bhl_lat", "bhl_long", "datum",
    "sec", "twn", "rng", "meridian", "servco",
    "date_sub", "start_date", "end_date", "flow_date", "fm", "stages_no",
]


# --------------------------------------------------------------------------- #
# Fetch (stdlib only — dry-run needs no third-party deps)
# --------------------------------------------------------------------------- #
def _get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "mineral-rights-tracker/0.1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_features(limit: int | None = None):
    """Yield ArcGIS features (attributes + geometry), paginating the layer."""
    offset = 0
    fetched = 0
    while True:
        page = PAGE_SIZE if limit is None else min(PAGE_SIZE, limit - fetched)
        if page <= 0:
            return
        params = urllib.parse.urlencode({
            "where": "1=1",
            "outFields": ",".join(OUT_FIELDS),
            "returnGeometry": "true",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": page,
            "f": "json",
        })
        data = _get_json(f"{LAYER_URL}/query?{params}")
        feats = data.get("features", [])
        if not feats:
            return
        for f in feats:
            yield f
            fetched += 1
            if limit is not None and fetched >= limit:
                return
        # Stop when the server signals no more pages.
        if not data.get("exceededTransferLimit") and len(feats) < page:
            return
        offset += len(feats)


# --------------------------------------------------------------------------- #
# Transform
# --------------------------------------------------------------------------- #
def epoch_ms_to_date(v) -> str | None:
    if v in (None, ""):
        return None
    try:
        return datetime.fromtimestamp(int(v) / 1000, tz=timezone.utc).date().isoformat()
    except (ValueError, OverflowError, OSError):
        return None


def format_api(api) -> str | None:
    """OCC serves the API as a number, e.g. 3509920678 -> '35-099-20678'."""
    if api in (None, ""):
        return None
    try:
        digits = str(int(float(api))).zfill(10)
    except (ValueError, TypeError):
        return None
    return f"{digits[0:2]}-{digits[2:5]}-{digits[5:10]}"


def _to_int(v) -> int | None:
    if v in (None, ""):
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def linestring_wkt(geometry: dict | None) -> str | None:
    """Build a LINESTRING WKT (lon lat order, for geography) from the polyline.

    ArcGIS polylines can have multiple paths; use the longest. Drop consecutive
    duplicate vertices. Return None if fewer than 2 distinct points.
    """
    if not geometry:
        return None
    paths = geometry.get("paths") or []
    if not paths:
        return None
    longest = max(paths, key=len)
    pts: list[tuple[float, float]] = []
    for pt in longest:
        x, y = pt[0], pt[1]
        if not pts or pts[-1] != (x, y):
            pts.append((x, y))
    if len(pts) < 2:
        return None
    coords = ", ".join(f"{x} {y}" for x, y in pts)
    return f"LINESTRING({coords})"


def transform(feature: dict) -> dict:
    a = feature.get("attributes", {})
    county = (a.get("county") or "").strip() or None
    return {
        "oid": _to_int(a.get("oid")),
        "api": format_api(a.get("api")),
        "well_name": (a.get("wellname") or "").strip() or None,
        "operator_name": (a.get("opname") or "").strip() or None,
        "operator_number": (a.get("opnum") or "").strip() or None,
        "county": county,
        "shl_latitude": a.get("shl_lat"),
        "shl_longitude": a.get("shl_long"),
        "bhl_latitude": a.get("bhl_lat"),
        "bhl_longitude": a.get("bhl_long"),
        "source_datum": (a.get("datum") or "").strip() or None,
        "section": _to_int(a.get("sec")),
        "township": (a.get("twn") or "").strip() or None,
        "rng": (a.get("rng") or "").strip() or None,
        "meridian": (a.get("meridian") or "").strip() or None,
        "service_company": (a.get("servco") or "").strip() or None,
        "submitted_date": epoch_ms_to_date(a.get("date_sub")),
        "start_date": epoch_ms_to_date(a.get("start_date")),
        "end_date": epoch_ms_to_date(a.get("end_date")),
        "flow_date": epoch_ms_to_date(a.get("flow_date")),
        "formation": (a.get("fm") or "").strip() or None,
        "stages": _to_int(a.get("stages_no")),
        "path_wkt": linestring_wkt(feature.get("geometry")),
        "raw": a,
    }


# --------------------------------------------------------------------------- #
# Load (raw staging) + normalize (-> activity). Requires psycopg + SUPABASE_DB_URL.
# --------------------------------------------------------------------------- #
INSERT_RAW = """
insert into public.raw_ok_laterals (
  oid, api, well_name, operator_name, operator_number, county,
  shl_latitude, shl_longitude, bhl_latitude, bhl_longitude, source_datum,
  section, township, rng, meridian, service_company,
  submitted_date, start_date, end_date, flow_date, formation, stages,
  path, raw
) values (
  %(oid)s, %(api)s, %(well_name)s, %(operator_name)s, %(operator_number)s, %(county)s,
  %(shl_latitude)s, %(shl_longitude)s, %(bhl_latitude)s, %(bhl_longitude)s, %(source_datum)s,
  %(section)s, %(township)s, %(rng)s, %(meridian)s, %(service_company)s,
  %(submitted_date)s, %(start_date)s, %(end_date)s, %(flow_date)s, %(formation)s, %(stages)s,
  case when %(path_wkt)s is null then null else st_geogfromtext(%(path_wkt)s) end,
  %(raw)s
)
"""

# Normalize raw_ok_laterals -> unified activity. Idempotent via the
# (source_table, source_id) unique constraint on activity.
#
# One physical well can file multiple frac notices (multiple raw rows with the
# same API + bottom-hole location — e.g. a refrac). Those are the SAME lateral,
# so we dedupe to one activity row per distinct (api, bhl) and keep the most
# recent notice. Genuinely multi-lateral wells have distinct BHLs and are kept
# separate. source_id encodes that lateral identity so re-runs are idempotent.
# Rows without a bottom-hole location are skipped (nothing to plot as a lateral).
NORMALIZE = """
insert into public.activity (
  state, county, county_fips, api_number, well_name, operator, record_type,
  event_date, status, latitude, longitude, bhl_latitude, bhl_longitude, path,
  well_type, source_state_agency, source_table, source_id
)
select distinct on (api, bhl_latitude, bhl_longitude)
  'OK', county, null, api, well_name, operator_name, 'well'::activity_record_type,
  coalesce(flow_date, start_date, submitted_date), null,
  shl_latitude, shl_longitude, bhl_latitude, bhl_longitude, path,
  'horizontal', 'OCC', 'raw_ok_laterals',
  coalesce(api, '') || '|' || bhl_latitude::text || ',' || bhl_longitude::text
from public.raw_ok_laterals
where bhl_latitude is not null and bhl_longitude is not null
order by
  api, bhl_latitude, bhl_longitude,
  coalesce(flow_date, start_date, submitted_date) desc nulls last
on conflict (source_table, source_id) do update set
  county        = excluded.county,
  api_number    = excluded.api_number,
  well_name     = excluded.well_name,
  operator      = excluded.operator,
  event_date    = excluded.event_date,
  latitude      = excluded.latitude,
  longitude     = excluded.longitude,
  bhl_latitude  = excluded.bhl_latitude,
  bhl_longitude = excluded.bhl_longitude,
  path          = excluded.path,
  well_type     = excluded.well_type;
"""


def load_env_file() -> None:
    """Load KEY=VALUE lines from ingestion/.env into os.environ if present."""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def ingest(limit: int | None = None) -> None:
    import psycopg
    from psycopg.types.json import Json

    load_env_file()
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        sys.exit(
            "SUPABASE_DB_URL not set. Add it to ingestion/.env or the environment.\n"
            "Get it from Supabase dashboard -> Project Settings -> Database -> Connection string."
        )

    print("Fetching laterals from OCC HF_LATERALS ...", file=sys.stderr)
    rows = [transform(f) for f in fetch_features(limit=limit)]
    for r in rows:
        r["raw"] = Json(r["raw"])
    print(f"Fetched {len(rows)} laterals. Writing to Postgres ...", file=sys.stderr)

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("truncate table public.raw_ok_laterals")
            cur.executemany(INSERT_RAW, rows)
            cur.execute(NORMALIZE)
            cur.execute(
                "select count(*) from public.activity where source_table = 'raw_ok_laterals'"
            )
            activity_count = cur.fetchone()[0]
        conn.commit()

    print(
        f"Done. raw_ok_laterals: {len(rows)} rows; "
        f"activity (OK laterals): {activity_count} rows."
    )


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest OCC HF_LATERALS -> Supabase.")
    parser.add_argument(
        "--dry-run", type=int, metavar="N", default=None,
        help="Fetch N features, print transformed rows, and exit. No DB / no secrets.",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Ingest only the first N features (for testing a real write).",
    )
    args = parser.parse_args()

    if args.dry_run is not None:
        rows = [transform(f) for f in fetch_features(limit=args.dry_run)]
        with_path = sum(1 for r in rows if r["path_wkt"])
        for r in rows:
            preview = dict(r)
            wkt = preview.pop("path_wkt")
            preview.pop("raw")
            preview["path_wkt_len"] = len(wkt) if wkt else 0
            print(json.dumps(preview, indent=2, default=str))
        print(
            f"\n{len(rows)} rows | {with_path} with a lateral path "
            f"| {len(rows) - with_path} without.",
            file=sys.stderr,
        )
        return

    ingest(limit=args.limit)


if __name__ == "__main__":
    main()
