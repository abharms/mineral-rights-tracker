# Mineral Rights Tracker

A subscription product for mineral owners: a map + dashboard of oil & gas activity
(wells, permits, horizontal laterals) near a user's holdings, with alerts.

- **Product & pricing strategy:** [`STRATEGY.md`](./STRATEGY.md)
- **Data spec + how to add a new state:** [`SPEC.md`](./SPEC.md)

## Repo layout

| Path | What it is |
|------|-----------|
| `web/` | Next.js 16 app (App Router, TypeScript, Tailwind + shadcn/ui, MapLibre). The frontend and its serverless/route-handler logic. |
| `ingestion/` | Python state adapters (fetch → raw staging → normalize into `activity`). |
| `supabase/` | Database migrations (`supabase/migrations`) + CLI config. |
| `SPEC.md` / `STRATEGY.md` | Data spec and product/tech decisions. |

## Architecture (short version)

`state sources → raw staging tables → normalization → unified activity table → map/dashboard`

- **Supabase** is the backend (Postgres + PostGIS, Auth, RLS, auto REST API). No separate API server.
- **Python jobs** ingest each state and write directly to Postgres.
- The map queries a **viewport-bounded** PostGIS function (`activity_in_bbox`) that returns GeoJSON — never the whole table.

See `STRATEGY.md` §5 for the full rationale.

## Prerequisites

- Node (project uses v25) + npm
- Python 3
- **Supabase CLI** — installed as an npm dev-dep at `web/node_modules/.bin/supabase`
  (Homebrew install currently fails on this machine due to outdated Xcode Command
  Line Tools — the npm CLI works fine).
- Docker is **not** required for `supabase db push`. It *is* required for the local
  Supabase stack (`supabase start`) and `supabase db dump`; use live introspection
  (`supabase gen types`) instead when Docker isn't available.

## Environment / secrets

Secrets are gitignored; templates are committed.

- **`web/.env.local`** (copy from `web/.env.local.example`):
  - `NEXT_PUBLIC_SUPABASE_URL` — `https://<project-ref>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the **publishable** key (safe for the browser)
- **`ingestion/.env`** (copy from `ingestion/.env.example`):
  - `SUPABASE_DB_URL` — Postgres connection string. **Use the Session pooler URI**, not
    the direct connection (this project doesn't expose the `db.<ref>.supabase.co`
    direct host — only the pooler resolves). Shape:
    `postgresql://postgres.<project-ref>:<password>@aws-1-us-west-2.pooler.supabase.com:5432/postgres`

Linked Supabase project: **mineral-rights-tracker** (region us-west-2).

## Common tasks

**Run the web app / see the map**
```bash
cd web
npm install
npm run dev
# http://localhost:3000/map  (Oklahoma horizontal laterals)
```

**Apply database migrations** (run from `mineral-app/`)
```bash
web/node_modules/.bin/supabase db push
web/node_modules/.bin/supabase migration list        # verify local == remote
```

**Regenerate TypeScript types after a schema change**
```bash
web/node_modules/.bin/supabase gen types typescript --linked \
  > web/src/lib/supabase/database.types.ts
```

**Run an ingestion job**
```bash
cd ingestion
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt   # first time
./.venv/bin/python ok_hf_laterals.py --dry-run 5   # fetch+transform only, no DB, no secrets
./.venv/bin/python ok_hf_laterals.py --limit 500   # small real load
./.venv/bin/python ok_hf_laterals.py               # full load + normalize into activity
```

## Current status (as of last session)

**Working end-to-end:**
- Next.js app scaffolded (Tailwind + shadcn/ui, Supabase auth helpers via `@supabase/ssr`).
- DB schema live: `profiles`, `ownership_tracts`, per-state raw staging, unified `activity`
  (with surface + bottom-hole coords and a `path` linestring for laterals), all RLS-enabled.
- **Oklahoma horizontal laterals ingested** (`ingestion/ok_hf_laterals.py`): ~8,245 distinct
  laterals from OCC `HF_LATERALS`, with SHL/BHL and multi-vertex traces.
- **`/map`** renders those laterals via MapLibre, re-querying `activity_in_bbox` on pan/zoom,
  with a click popup and live in-view count.

**Not yet built:**
- OK vertical wells + permits (`COMP_WELLS` / `ITD_WELLS` → points on the map).
- Texas ingestion (RRC county shapefiles for coordinates — see `SPEC.md`; bigger lift).
- Ownership entry, county matching, dashboard, alerts (Tier-2 loop).
- Auth flow + Stripe subscription gating.
- Scheduling (GitHub Actions cron) for the ingestion jobs.

## Gotchas worth knowing

- **Next.js 16 renamed `middleware.ts` → `proxy.ts`.** See `web/AGENTS.md`; read the bundled
  docs under `web/node_modules/next/dist/docs/` before assuming an API.
- **Supabase direct DB host doesn't resolve** for this project — use the Session pooler.
- **`activity.county` is nullable** — some source records have coordinates but no county;
  they plot on the map but are excluded from county matching until the county is derived.
