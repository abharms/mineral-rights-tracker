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

**Reuse from current codebase:** `ingestion/tx_rrc_parse.py`,
`ingestion/tx_rrc_parse_wellbore.py` (verified TX parsers); OK ArcGIS query logic in
`viewer/src/app/app.ts` (`OCC_BASE`, `buildOkWhere`, `loadOkWells`, `loadOkPermits`);
`viewer/src/app/tx-county-codes.ts` (county crosswalk). Keep Angular for the app.

**Suggested stack (from `SPEC.md`):** Supabase/Postgres + Auth, Angular frontend, Python
ingestion, GitHub Actions cron scheduling, Stripe for the subscription gate.

**Housekeeping noted:** delete leftover root-level `package.json`/`package-lock.json`/
`node_modules` (Angular CLI scaffolding — real deps live in `viewer/`); add
`requirements.txt`/`pyproject.toml` for `ingestion/`.
