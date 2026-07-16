# Tract Onboarding / Ownership Entry — Content Brief

## What this screen is

This is how a user tells us what mineral interests they own. It's self-reported — we don't
verify it against county records. A user can own more than one tract (a "tract" is one distinct
piece of mineral ownership), and everything else in the product (the dashboard, activity
matching, the map) is organized around the tracts entered here.

This flow needs to work both as: (1) first-time setup for a brand-new user with zero tracts,
and (2) an "add another tract" action for an existing user who already has some.

## Fields to collect, per tract

| Field | Required? | Notes |
|---|---|---|
| Label / nickname | Optional | Free text (e.g. "Home Place," "Grandma's"). If left blank, the app displays a computed name instead, like "Garvin County Tract" — so this field should be presented as optional/nice-to-have, never as something the user must fill in to proceed |
| State | Required | MVP only supports Oklahoma and Texas — the field should not allow other states yet |
| County | Required | Depends on the state selected |
| Approximate acres | Optional | Numeric |
| Interest type | Required | One of: Mineral, Royalty, or NPRI (non-participating royalty interest) — default/most common is Mineral |
| Legal description | Optional | Free text (e.g. section/township/range). Not used for matching yet in MVP (matching is county-level only), but stored for future use |
| Operator | Optional | Free text — the company operating the well/lease, if known |
| Notes | Optional | Free text, for anything else the user wants to remember about this tract |

## Multi-tract behavior

- A user can add any number of tracts.
- After adding one tract, there needs to be a clear way to add another (not just a one-and-done
  form).
- If the user already has tracts, they should be able to see/manage the list of tracts they've
  already entered from this same area (not just add blind).

## What happens after

Once at least one tract is saved, the user's dashboard becomes populated (tracts + any activity
matched to them). There isn't a separate "confirmation" step beyond saving — saving a tract is
the action that makes it appear on the dashboard.

## Honesty constraint (important)

Ownership here is **self-reported and unverified** — we do not check it against county/deed
records. Nothing about this screen should imply we've validated or confirmed the user's
ownership claim.

## States to design for

- Zero tracts (first-time / empty state)
- One or more tracts already added (returning user adding another)
- A tract being actively filled out (form/entry state)

## Out of scope for this screen

- Uploading documents (deeds, leases, etc.) — not part of this flow.
- Parcel-level or legal-description-based precision matching — that's a future capability; for
  now, matching activity to a tract works at the county level only, regardless of what's entered
  in "legal description."
- Payment/subscription — handled separately (account/billing).
