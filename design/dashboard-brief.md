# Dashboard — Content Brief

## What this screen is

The dashboard is the first screen a logged-in user sees. It's a personalized view of what's
happening on and near the user's own land — not a general search tool. It answers: "what's
happening with my minerals?"

## Content blocks and their data

### 1. Header
- Page title
- Short subhead

### 2. Summary stats
Four numbers, each with a label:

| Stat | Meaning |
|---|---|
| Tracts tracked | Count of the user's saved tracts |
| Total acres | Sum of approximate acreage across all their tracts |
| New activity | Count of new wells/permits detected recently |
| Active counties | Count of distinct counties with activity near the user's tracts |

### 3. Your tracts
One card per tract the user owns. Each tract has this data available:
- Label/nickname (user-given, e.g. "Garvin — Home Place")
- State
- County
- Approximate acres
- Interest type (mineral / royalty / non-participating royalty interest)
- Operator (optional)
- Notes (optional, free text)

Each tract also has an activity status:
- Either: a count of new activity events, or "quiet" (no recent activity) — both are normal,
  expected states
- If there's activity, the most recent event on/near that tract is available (see activity
  event fields below) to show as a preview

### 4. Recent activity
A list of the most recent activity events across all the user's tracts, newest first (not
grouped by tract). Each row uses the same activity event fields below.

### 5. Plan / monitoring status
The user's subscription tier is **account-wide, not per-tract** — a user is either on the base
tier (look up activity yourself) or the monitored tier (we watch and alert you), and that status
applies to their whole account, not individually per tract. This should be shown once (e.g. a
"Your Plan" panel), not repeated on every tract card. Data available: current plan name, a short
description of what it includes, and — if not on the monitored tier — what upgrading adds
(automatic monitoring, instant alerts, summary reports).

## Activity event — full field list

Each activity event (a well or a permit) has:
- Record type: well or permit
- Well/lease name
- Operator name
- County
- API number (the well's official regulatory ID)
- Status (e.g. "Permit filed," "Spud" [drilling begun], "Producing")
- Date
- A plain-English explanation of what the status means (this may belong on a detail view rather
  than the dashboard itself — designer's call)

## States that exist and need a design

- Has activity (some or all tracts show new activity)
- All quiet (no tracts have recent activity)
- Zero tracts (a new user hasn't added any land yet)
- Loading (data not yet available)

## Audience note

Users are mostly non-experts — people who inherited a mineral interest, often without oil & gas
background, checking in periodically rather than daily. Relevant for word choice and how much
is assumed to be understood, not for visual style.

## Out of scope for this screen

- The interactive map (separate screen)
- Editing tract details, documents, valuation, offer tracking (later phase, not MVP)
- General search across public well data (this screen is about the user's own tracts only)
