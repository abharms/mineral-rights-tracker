# Mineral Rights App — Strategy & Decisions (working doc)

_A running record of our product-direction and pricing conversation. Not an implementation
plan yet — decisions, rationale, and open questions._

---

## 1. Product direction

**Decision: the app is a personal mineral-ownership product, not just a search tool — but the
map is the hook that sells it.**

Two visions were compared:
- **Plan A (original `SPEC.md`)** — a subscription *search tool* over public OK/TX well/permit
  data. Weakness (admitted in the spec): value is convenience, not exclusive data → weak
  retention for a monthly subscription.
- **Plan B (2nd opinion)** — a *personal ownership dashboard*: user declares what they own →
  background jobs ingest state activity → matching engine relates activity to their holdings →
  dashboard + proactive alerts + plain-English explanations.

**Resolution:** Plan B is a *superset* of Plan A, not a competing rewrite (both share
`state sources → raw → normalized`). All current work is reused regardless (OK ArcGIS
integration, TX bulk parsers, county codes).

**The map's role (partner's idea, industry expert):** a continuously-updated map of well/permit
activity. Reconciled as follows — the map is a **presentation layer and the acquisition hook**,
not a separate strategy:
- **Map = pull interface.** The user comes to look. Monetizes the engaged/active segment
  (investors, landmen, owners in a hot play).
- **Alerts = push interface.** Value comes to the user. Captures the passive majority
  (inherited-interest owners who won't log in but will open a "permit filed near you" email).
- Same underlying value ("activity updates all the time"); two engagement levels.

---

## 2. Pricing model (current thinking)

**Structure decided by owner:** free trial → then paid, with two tiers.

| | **Tier 1 — "You look it up"** | **Tier 2 — "We watch it for you"** |
|---|---|---|
| Price | **$25 / month** (partner's read: people will pay this for constantly-updated activity) | Higher tier (price TBD) |
| Includes | Data + interactive map + **save your own tracts and see them + nearby activity on the map** | Everything in Tier 1 **plus** alerts, automated monitoring, ownership dashboard tools, offer tracker, valuation, document vault, consulting perks |
| Access before pay | **Free trial** (time-boxed; permanent free tier parked — see open questions) | — |

**The tier boundary = "look it up yourself" vs. "we watch it for you"** (pull vs. push). Clean and
instantly understandable to a customer.

**Refinement applied:** keep "see *my own* tracts + nearby activity on the map" inside Tier 1, not
paywalled up — personalizing the map is most of its wow and is cheap to include. Tier 2 is
specifically the automation/monitoring/decision layer that runs *without the user logging in*.

**Build sequencing this unlocks:** ship **Tier 1 (map + data + personal tracts) first** — fastest
path to revenue, validates the partner's $25 bet with real customers — then add **Tier 2
(monitoring/Plan B)** as the paid expansion. Map-first and Plan B become phase 1 and phase 2, not
either/or.

**On "freshness as paywall":** considered (free = delayed data, paid = live, like stock quotes),
but **rejected by owner** in favor of the simpler free-trial → $25 model above. Noted for the
record.

---

## 3. Open questions / risks to watch

- **Is Tier 1 strong enough to retain on its own?** By putting alerts in Tier 2, Tier 1's
  retention rests entirely on the map being engaging enough that people keep opening it. That may
  hold for the active/investor segment (partner's bet). But the **passive inherited-owner who
  won't log in to watch a map is the one retained by alerts — which now sit a tier up.** So Tier 1
  leans on map stickiness; the Tier 2 upsell pitch is literally "stop having to check — we'll tell
  you." **Base-tier (Tier 1) churn among passive owners is the key number to watch.** Open
  question: is the map alone enough, or does some lightweight alert belong in Tier 1 to shore up
  retention?
- **County-level matching is coarse.** A user in an active county may see lots of activity not
  actually near their acreage. Mitigation: collect legal description / section-township-range at
  signup now (even though v1 matches only at county level) so precision can improve later without
  re-collecting.
- **"Always updating" is bounded by agency cadence.** OK permits can be near-daily (good — the
  exciting leading indicator). TX wellbore/production bulk file updates ~monthly. Don't
  over-promise real-time on data the state only publishes monthly; pitch freshness around the
  fast-moving datasets (permits, new drilling).
- **Trial vs. permanent free tier (parked).** Owner chose a time-boxed trial (simpler, creates
  urgency). The only reason to consider a permanent limited free tier instead: it's an ongoing
  **lead pool for the (separate) consulting business** — free users are exactly who might book a
  consult. Revisit later.
- **App vs. consulting business.** The app must stand alone as a subscription business; the
  consulting firm is a *separate* business that can cross-promote. Consulting integrations stay
  as optional CTAs / Tier 2 perks, never a dependency for the app's value.

---

## 4. Architecture (for when we build — unchanged by pricing)

```
[OK adapter: ArcGIS REST]   [TX adapter: bulk file download + parse]
              \                        /
               → raw staging tables (mirror source shape)
               → normalization layer → unified activity table
               → (Tier 2) ownership matching engine → activity feed → alerts
               → map + dashboard (Tier 1 = map/data; Tier 2 = personalized monitoring)
```

**Frontend framework decision: Next.js (React) — replacing the Angular spike.** Rationale:
- Most-documented Supabase + Stripe SaaS path → most reliable AI-assisted build (we lean on
  Claude heavily for the code).
- Mature React map tooling (`react-map-gl` for MapLibre/Mapbox) — the map is the Tier 1 core
  feature; React removes the imperative-lifecycle glue pain on the *client* (note: the hard
  *geospatial backend* work — PostGIS, viewport queries, clustering — is framework-agnostic).
- Built-in route handlers/server actions can absorb the Stripe webhook + alert-email functions
  into one repo/deploy.
- Strong SSG/ISR for the SEO landing page (Section 6).
- Chosen over **Angular** (owner is personally stronger in Angular, but Claude writes most code,
  which shrinks that advantage) and over **Remix** (folded into React Router v7 / mid-transition;
  smaller ecosystem and thinner AI corpus). Nuxt/Vue would give similar benefits if Vue were
  preferred.

**Transition plan (cheap — the frontend is a thin spike):**
- **Python ingestion/parsers — untouched** (framework-agnostic; they write to Supabase).
- **Port the thin reusable TypeScript/data** from the Angular viewer to the Next app: OK ArcGIS
  query params/field lists in `viewer/src/app/app.ts` (`OCC_BASE`, `buildOkWhere`,
  `loadOkWells`, `loadOkPermits`) and `viewer/src/app/tx-county-codes.ts` (county crosswalk).
- **Retire the Angular `viewer/`** — keep as a reference spike while building, then remove. It was
  always going to be rewritten from "raw data viewer" into the real map + dashboard product.

**Styling / UI framework decision: Tailwind CSS + shadcn/ui.**
- **shadcn/ui** = accessible components (Radix primitives + Tailwind) **copied into the repo**, not
  an installed dependency — we own and customize the code. Most AI-reliable option (matters since
  Claude writes most code), accessible by default, themeable via CSS variables for brand + dark
  mode.
- Tailwind styles all the *chrome* around the map (filter panels, popovers, cards, dashboard); the
  map canvas itself is WebGL via `react-map-gl`.
- **Not** using Tailwind Plus (owner's call — no paid UI kit); build landing/marketing sections
  from Tailwind + shadcn directly.
- Dashboard charts later, if needed: **Recharts** or **Tremor** (both Tailwind-friendly React).
- Avoid MUI / Chakra / Mantine / Ant Design — they bring competing style systems that clash with
  Tailwind.

**Stack (updated):** **Next.js (React)** frontend + **Tailwind CSS + shadcn/ui** + Supabase/Postgres
(PostGIS) + Auth + RLS, **Python** ingestion, GitHub Actions cron scheduling, Stripe subscription
gate, MapLibre/`react-map-gl` for the map.

**Housekeeping noted:** delete leftover `package.json`/`package-lock.json`/`node_modules`
(Angular CLI scaffolding) and the Angular `viewer/` once ported; add
`requirements.txt`/`pyproject.toml` for `ingestion/`.

---

## 5. Tech stack & scalability (decisions + rationale)

### Does Supabase act as a backend? Yes — mostly. No separate general API server needed.

Supabase is a **backend-as-a-service**: real Postgres + an auto-generated REST/GraphQL API over
your tables + Auth (signup/login, JWT) + **Row-Level Security (RLS)** + Storage (future document
vault) + Edge Functions (serverless TypeScript). For the standard app (users save tracts, load
dashboard/map, read activity), the **Next.js app talks to Supabase directly** (browser via the
client SDK, and server-side via server components / route handlers) and RLS enforces who sees
what — so we do **not** build or host a traditional API server for CRUD.

Mental model: not `Browser → our API server → DB` (3-tier). Instead
`Browser → Supabase (DB + auto-API + auth + RLS)`; we only write server code for the few things
that truly need it.

### We still have server-side code — as *jobs and functions*, not an API tier

Three parts can't live in the browser:
1. **Ingestion** — OK ArcGIS pulls + TX bulk download/parse (existing Python). Scheduled jobs.
2. **Stripe** — anything using the Stripe *secret* key (checkout sessions, subscription
   webhooks) must run server-side. A few serverless functions.
3. **Matching + alerts + email** — compare new activity vs. ownership, send alert emails, on a
   schedule.

**Nuance:** Supabase Edge Functions run on Deno (TypeScript), so **Python ingestion won't run
natively inside Supabase.** Pattern: run Python ingestion as **GitHub Actions cron** (or a cheap
worker on Fly.io/Railway/Render later) connecting directly to Supabase Postgres with a service
key. **With Next.js, the Stripe webhook + alert-email functions can live as Next route handlers
in the same repo/deploy** (instead of separate Supabase Edge Functions) — one fewer moving part.

### The system is (now) three pieces
1. **Next.js app** (frontend **+** the Stripe/email serverless logic as route handlers)
2. **Supabase** (managed — DB, auth, CRUD API, RLS, storage)
3. **Python jobs service** (ingestion + matching, scheduled via GitHub Actions)

### Scalability: comfortable for this product; watch *data*, not user concurrency
- **Scale is niche** — thousands to tens of thousands of $25/mo users, mostly *reads*. Postgres
  handles this easily; user concurrency is not the concern.
- **Geospatial is the one real design concern.** TX alone has 1M+ historical wells; a busy county
  has thousands of points. **Do not ship all points to the browser.** Use **PostGIS** + spatial
  indexes + **query-by-viewport with zoom-based clustering / vector tiles.** Map client:
  **MapLibre GL** (open-source) or Mapbox, not basic Leaflet.
- **Data growth per added state** — handled with indexing + partition-by-state; fine for years.
- **Ingestion is batch, off the user path** — scales independently as a background job.
- **No DB lock-in** — Supabase *is* Postgres; can lift-and-shift to RDS/any Postgres host later.
  Only Auth + Edge Functions are Supabase-specific, and both are replaceable.

**Bottom line:** the stack is well-matched and scales past where this product is realistically
going. The hard problems are *data engineering* (ingestion reliability, normalization quality,
geospatial query performance), solved within this stack — not reasons to change it.

**Security note:** RLS is the security boundary and is easy to misconfigure — it needs deliberate
setup and testing so a user can never read another user's ownership data.

---

## 6. Landing page

**Goal:** convert visitors → free-trial signups. The map is the hook, so it leads. This is a
marketing surface, distinct from the logged-in app.

### Page structure (derived from the positioning above)
1. **Hero** — the map front and center (interactive demo or rich screenshot with activity pins).
   Owner-language headline, not jargon (e.g. "Know what's happening on your minerals" / "See oil
   & gas activity on your land — as it happens"). Primary CTA: **Start your free trial**;
   secondary: **See the map**.
2. **The problem** — most owners (especially inherited-interest owners) don't know what they own
   or what's happening near it.
3. **How it works, 3 steps** — tell us what you own → we track OK & TX activity → see it on your
   map. (Tier 2 teaser: "and we'll alert you when something changes.")
4. **Map showcase (Tier 1 value)** — the personalized "your acreage + nearby activity" view.
5. **"We watch it for you" (Tier 2 upsell)** — alerts + monitoring; the retention pitch.
6. **Plain-English explanations** — the educational angle; big trust-builder for non-experts.
7. **Pricing** — free trial → **$25/mo Tier 1**, higher Tier 2. Keep it dead simple.
8. **Who it's for / credibility** — inherited owners, investors, landmen; lean on the partner's
   industry expertise.
9. **Soft consulting cross-link** — "Need expert help reading an offer? Talk to a consultant"
   (the separate consulting business, gently).
10. **FAQ + footer CTA** — data is public/state-sourced; coverage is OK+TX (more coming); your
    ownership info is private (self-reported, protected by RLS).

### Where it lives (technical)
A marketing page must be **fast and SEO-indexable** (organic search like "oil gas activity my
county"). Next.js handles this natively, so:
- **Static/ISR route in the Next app (recommended to start)** — the landing page is a
  statically-generated (SSG) or ISR public route in the same Next codebase; the app sits behind
  login (e.g. `/app` or an authed route group). One codebase, one deploy, excellent SEO.
- **Separate static marketing site** (Astro / plain HTML+Tailwind) at the apex domain, app at
  `app.<domain>`. More marketing-iteration flexibility; slightly more to manage.

Start with the SSG/ISR route in the Next app; split out only if marketing iteration demands it.

### Assets on hand
`logo-final.png` / `logo-light.png` (dark/light logo variants) live at the container level above
`mineral-app/`; land/activity photos in `Images/` could seed hero/section imagery.
