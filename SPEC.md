# Mineral Rights Activity Tracker — Project Spec

## What this is

A subscription web app for mineral rights owners. Users sign up by providing their contact
information and ownership details (self-reported, not sourced from public records) along with
a monthly fee. In exchange, they can search current oil & gas activity — wells and drilling
permits — in their state/county so they can stay informed about what's happening on or near
their mineral interests.

## Business model

- **What the app gets from users:** contact information + ownership details (self-reported at
  signup), plus a recurring monthly subscription fee.
- **What users get:** searchable oil & gas activity (wells + drilling permits) filtered by
  state, county, and date range.
- Value proposition isn't "we have data nobody else has" — state regulators publish this data
  publicly. The value is aggregation, relevance, and convenience: one place to check multiple
  states/counties instead of hunting across separate government portals, plus (eventually)
  proactive alerts when something new shows up in an owner's area.

## MVP scope

**In scope:**
- Current wells (status, operator, location)
- Applications to drill / drilling permits
- Coverage: **Oklahoma and Texas only** for launch
- Search UX: user selects state → county → date range, sees matching wells/permits
- Signup flow: contact info + ownership details (self-reported) + Stripe subscription gate
  before activity data is visible

**Explicitly out of scope for MVP:**
- Lease data — this lives in county-level recorder/clerk records (not state regulatory
  agencies), isn't published in bulk, and is generally accessed either through paid aggregators
  (Enverus, MineralRecords.com, TexasFile) or county-by-county public records requests. Skipping
  entirely for now since the self-reported ownership model doesn't require it.
- Precise parcel/radius-level matching — v1 matches at the county level only. Legal
  description/parcel-level matching is a possible v2 feature.
- Any attempt to independently source or verify mineral ownership from public records. Ownership
  data in this app is always self-reported by the user, not scraped or purchased.
- Multi-state expansion beyond OK/TX (design the ingestion layer to make this easy later, but
  don't build extra state adapters yet).

## Data sources

### Oklahoma — Oklahoma Corporation Commission (OCC)
- OCC runs an ArcGIS Online open data portal: `gisdata-occokc.opendata.arcgis.com`
- This exposes genuine ArcGIS REST "Feature Service" endpoints — queryable by attribute and
  bounding box, returns JSON/GeoJSON, supports pagination. This is the preferred integration
  path (real API, not scraping).
- Also has an "OCC Well Data Finder" GIS web app and downloadable datasets for wells and
  permits.
- Action: inspect the ArcGIS open data portal for well and permit feature layers, confirm field
  names/schema, and build a REST-based ingestion job (poll on a schedule — daily is likely
  sufficient).

**Confirmed layers (ArcGIS REST base `https://gis.occ.ok.gov/server/rest/services/Hosted`):**
- `COMP_WELLS/FeatureServer/331` — completed wells (surface points). Already used by the viewer
  spike. Fields incl. `api_number`, `well_name`, `operator_name`, `well_status`, `well_type`,
  `county`, `spud`, `well_completion`.
- `ITD_WELLS/FeatureServer/290` — permits / intents to drill. Fields incl. `entity_name`,
  `application_type`, `permit_status`, `submit_date`, `approval_date`, `expire_date`.
- **`HF_LATERALS/FeatureServer/95` ("All_Notices_Trace") — the horizontal/directional source.**
  ~8,548 laterals (verified July 2026), ALL with bottom-hole populated. Polyline geometry with
  multiple vertices (a segmented trace, not just a straight line). Carries BOTH endpoints as
  explicit fields: `shl_lat`/`shl_long` (surface) and `bhl_lat`/`bhl_long` (bottom hole), plus
  `api`, `opname`, `wellname`, `county`, frac `stages_no`, and dates. Geometry served natively in
  **WGS84 (wkid 4326)** — map-ready.
  - Coverage caveat: `HF_LATERALS` comes from OCC's completion/seismicity **notice** program, so
    it covers modern hydraulically-fractured horizontal wells — NOT older conventional
    directional wells. Vertical wells stay simple points from `COMP_WELLS`.
  - Datum caveat: geometry is served as WGS84, but the `datum` attribute reads NAD27, so the
    coordinates may carry a ~10–30 m NAD27 offset. Validate against a known well before treating
    as exact.

### Texas — Railroad Commission of Texas (RRC)
- RRC publishes bulk data sets for download: drilling permit info on every application to drill
  since 1976, and a Wellbore database with API numbers, completion/plug dates, etc.
- **No clean REST API.** Data comes as fixed-width ASCII text files and/or dBase (.dbf) files,
  distributed via a browser-driven download flow (some cumulate daily/monthly).
- **Important constraint:** RRC explicitly monitors for automated tools hitting their live
  interactive query pages and will terminate sessions/rate-limit if detected. Do NOT scrape the
  interactive search UI. Only pull from the sanctioned bulk-download data sets, which are
  intended for exactly this kind of use.
- Action: build a scheduled job that downloads the relevant bulk files (permits + wellbore),
  parses the fixed-width/DBF format into structured records, and loads into the raw staging
  table. This is more ETL work than Oklahoma — budget accordingly.

**Well locations & horizontal/directional data — IMPORTANT nuance.** There are two different TX
sources, and the one our current parser reads is the *wrong one for coordinates*:
- The **bulk permit file (`daf420.dat`)** our `ingestion/tx_rrc_parse.py` parses expresses
  bottom-hole location as **footage calls** (feet from survey/lease lines, e.g. "360 FS / 2087
  FW") plus abstract/survey/block references (record types 05/08) — **NOT latitude/longitude.**
  Converting footage-from-survey-lines to map coordinates would require the full Texas
  abstract/survey grid geometry — a hard georeferencing problem to avoid. (The permit file does
  carry some *surface* lat/long, but bottom-hole is footage.)
- **The coordinate source is a separate, free dataset: the RRC "Well Layers by County"
  shapefiles** (from the Data Sets Available for Download page). Free, updated ~twice weekly,
  packaged per county. Contains separate **Surface wells**, **Bottom wells**, and **Well arcs**
  layers as **lat/long decimal degrees, NAD27**, each carrying the **API number** to join back to
  permit/wellbore business data.
  - Precision ceiling: the "arcs" are **straight lines** from surface to bottom hole and, per
    RRC's own docs, "have no relation to the actual trace of the borehole." The true curved path
    (full directional survey) is published only as **PDF images** — not machine-readable.
  - Projection caveat: shapefiles are **NAD27** and MUST be reprojected to WGS84 (EPSG:4326) for
    web maps, or pins land ~100 m off.
- Net: TX gives a straight surface→bottom-hole line via bulk shapefiles (needs reprojection);
  OK gives a richer segmented trace via live API. Both yield a defensible lateral (direction +
  reach); neither is the exact borehole.

## Architecture

```
[State ingestion adapters] → [Raw staging tables] → [Normalization layer] → [Unified schema] → [App search API]
```

- **One ingestion adapter per state.** OK adapter calls the ArcGIS REST API. TX adapter
  downloads + parses bulk files. Each writes into a raw staging table that mirrors its source
  format as closely as possible — don't force normalization at ingestion time, do it as a
  separate step.
- **Normalization layer** maps each state's raw fields into one unified schema. County naming
  and codes will differ between states/sources — standardize to a consistent county reference
  (e.g. FIPS codes) here.
- **Unified schema (suggested fields):**
  - `state`
  - `county` (standardized name/FIPS)
  - `api_number` (well identifier)
  - `well_name`
  - `operator`
  - `record_type` (well vs. permit/application to drill)
  - `permit_date` / `spud_date` (whichever applies)
  - `status`
  - `latitude`, `longitude` — **surface hole location (SHL)**
  - `bhl_latitude`, `bhl_longitude` — **bottom hole location (BHL); null for vertical wells**
  - `path` — **lateral trace as a PostGIS `geography(linestring, 4326)`; null for verticals.**
    Populated with OK's multi-vertex polyline or TX's 2-point straight arc. Map renders a LINE
    when present, a POINT otherwise. All geometry stored in WGS84 (4326) — reproject at
    normalization time (TX shapefiles are NAD27).
  - `well_type`
  - `source_state_agency` (OCC / RRC — for traceability/debugging)
- **Scheduled ingestion jobs** — cron or a queue/worker, run per state on a cadence matching how
  often that state's source updates (check each agency's stated update frequency).
- **App queries the unified table only** — search-by-state/county/date-range stays simple and
  identical regardless of how messy or clean the underlying state source is.

## Adding a new state — data requirements & evaluation checklist

**Read this before scoping any new state.** Each state's regulator publishes data differently, so
the work of adding a state is: (1) find the sanctioned sources, (2) confirm they can satisfy the
unified contract below, (3) write a raw adapter + normalization mapping. Run the checklist before
committing to a state — it tells you upfront whether a state is an easy win or a hard one.

### The unified contract each state adapter must satisfy
The adapter's job is to populate the unified `activity` schema above. For each state, you must be
able to source (or reasonably approximate) these, per record:
1. **Identity/business fields** — `api_number`, `well_name`, `operator`, `record_type`
   (well vs. permit), `status`, relevant `*_date`, `county`.
2. **Surface hole location (SHL)** — `latitude`/`longitude`. Required for the base map pin.
3. **Bottom hole location (BHL)** — `bhl_latitude`/`bhl_longitude`, for horizontal/directional
   wells. This is what powers the "is a lateral under my land" feature.
4. **Lateral path** — a polyline for the trace (`path`), even if only a 2-point SHL→BHL line.
5. **A join key** — usually the API number — if location and business attributes live in
   separate datasets (they often do; see TX).

### Evaluation checklist for a new state's sources
- **Sanctioned access?** Is there a bulk download or a real REST/ArcGIS API? **Never scrape
  interactive query UIs** (legal/ToS risk — TX RRC actively polices this). If the only access is
  an interactive UI, the state is high-risk; deprioritize.
- **Coordinates present, and in what form?** Decimal-degree lat/long is ideal. Watch for
  alternatives that need conversion: **footage calls** (feet from survey/section lines — needs
  the survey grid geometry, hard), PLSS section-township-range (needs PLSS geometry), or
  state-plane coordinates (needs reprojection).
- **Bottom-hole / directional data available separately?** Often SHL and BHL live in different
  layers/files than the permit/well business data. Identify the specific directional layer
  (OK: `HF_LATERALS`; TX: county "Bottom wells" shapefile). Note its **coverage** (all wells? only
  modern horizontals? only wells that filed a notice?).
- **Projection/datum?** Record it and reproject everything to **WGS84 / EPSG:4326** at
  normalization. NAD27 (TX) and NAD83 differ enough to matter (tens of meters).
- **Update cadence?** Sets the cron schedule (OK API ~daily; TX shapefiles ~2×/week; some bulk
  files monthly). Don't poll faster than the source updates.
- **County identifier?** Map the state's county code/name to a consistent reference (FIPS) so it
  lines up with `ownership_tracts` for matching.
- **Precision ceiling?** Be honest in the UI about fidelity: exact wellhead vs. straight
  SHL→BHL arc vs. county-centroid fallback. True curved borehole traces are usually PDF-only —
  don't promise them.

### Fidelity tiers (for calibrating expectations & UI labeling)
Location quality degrades gracefully; store what you have and label it:
1. **Segmented lateral trace** (best available in bulk data) — OK `HF_LATERALS` multi-vertex line.
2. **Straight SHL→BHL arc** — TX county shapefiles.
3. **Surface point only** — vertical wells, or states without BHL data.
4. **County-centroid fallback** — records with no usable coordinates at all (flag as approximate).
5. **True curved borehole survey** — generally NOT machine-readable (PDF images); out of reach.

## Suggested tech stack

(Matches the developer's existing stack/preferences — adjust as needed.)

- **Backend/data store:** Supabase / PostgreSQL (consider PostGIS extension if/when
  radius or parcel-level matching becomes a feature)
- **Ingestion scripts:** Node.js/TypeScript or Python — whichever fits each state's format best
  (Python may be more convenient for parsing fixed-width/DBF files for Texas)
- **Scheduling:** cron, GitHub Actions, or a lightweight worker/queue
- **Frontend:** Vue 3/Nuxt 4 or React (developer has production experience with both) or
  Angular
- **Payments:** Stripe (subscription gating before activity data is shown)
- **Auth/user data:** Supabase Auth + Postgres tables for contact info and self-reported
  ownership details

## Legal/compliance notes to keep in mind

- Only use sanctioned bulk-download endpoints/APIs from state agencies — avoid automating
  against interactive query/search UIs, especially for Texas RRC, which actively polices this.
- Ownership and contact data collected at signup is self-reported by users, not sourced from
  public records — keep it that way for MVP to avoid the legal/technical complexity of county
  deed record access.
- If there's ever a future plan to share or sell user-submitted contact/ownership data (beyond
  showing it back to that user), get clear consent language into the privacy policy and ToS from
  the start rather than retrofitting later.

## Open questions / future roadmap (not MVP)

- Lease data integration (likely via a licensed aggregator rather than direct county access)
- Parcel/legal-description-level matching instead of county-level
- Proactive notifications/alerts when new activity appears in a user's county
- Expansion to additional states (Louisiana, New Mexico, North Dakota, Montana, Ohio,
  Pennsylvania are common producing states worth evaluating next — each needs its own data
  source check before being added). **Use the "Adding a new state — data requirements &
  evaluation checklist" section above to scope each candidate.**
