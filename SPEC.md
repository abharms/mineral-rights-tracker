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
  - `latitude`, `longitude`
  - `well_type`
  - `source_state_agency` (OCC / RRC — for traceability/debugging)
- **Scheduled ingestion jobs** — cron or a queue/worker, run per state on a cadence matching how
  often that state's source updates (check each agency's stated update frequency).
- **App queries the unified table only** — search-by-state/county/date-range stays simple and
  identical regardless of how messy or clean the underlying state source is.

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
  source check before being added)
