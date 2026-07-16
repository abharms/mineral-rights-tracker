/**
 * Static mock data for the UI mockups. Shaped like the real Supabase schema
 * (ownership_tracts, activity) so the screens reflect what we can actually
 * deliver. When we wire real data, replace the accessor functions at the bottom
 * with Supabase queries — components only call those, never this data directly.
 */

export type InterestType = "mineral" | "royalty" | "npri";
export type RecordType = "well" | "permit";
export type ActivityLevel = "active" | "quiet";

export interface Tract {
  id: string;
  /** User-given nickname. Optional — falls back to a computed label (see getTractDisplayLabel). */
  label?: string;
  state: string; // "OK"
  county: string;
  approxAcres: number;
  interestType: InterestType;
  operator?: string;
}

/** "Home Place" if the user set one, otherwise a computed fallback like "Garvin County Tract". */
export function getTractDisplayLabel(tract: Pick<Tract, "label" | "county">): string {
  return tract.label?.trim() || `${tract.county} County Tract`;
}

/** "2026-07-08" -> "July 8, 2026" */
export function formatEventDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export interface ActivityEvent {
  id: string;
  tractId: string;
  recordType: RecordType;
  wellType: "horizontal" | "vertical";
  title: string; // well/lease name
  operator: string;
  county: string;
  apiNumber: string;
  status: string;
  eventDate: string; // ISO
  daysAgo: number;
  /** Plain-English "what this means" for the educational layer. */
  explanation: string;
}

const TRACTS: Tract[] = [
  { id: "t1", label: "Home Place", state: "OK", county: "Garvin", approxAcres: 80, interestType: "mineral", operator: "Continental Resources" },
  { id: "t2", label: "North 160", state: "OK", county: "Kingfisher", approxAcres: 160, interestType: "mineral" },
  // Multi-state on purpose — exercises the TX/NM state-outline icons, not just OK.
  { id: "t3", label: "Grandma's", state: "TX", county: "Reeves", approxAcres: 40, interestType: "royalty" },
  // No label set — demonstrates the computed fallback (getTractDisplayLabel).
  { id: "t4", state: "NM", county: "Lea", approxAcres: 120, interestType: "mineral" },
];

const ACTIVITY: ActivityEvent[] = [
  {
    id: "a1", tractId: "t1", recordType: "permit", wellType: "horizontal",
    title: "OAK BARREL 1-36-25-24XHW", operator: "Continental Resources", county: "Garvin",
    apiNumber: "35-049-20678", status: "Permit filed", eventDate: "2026-07-08", daysAgo: 8,
    explanation:
      "A drilling permit lets an operator begin drilling once requirements are met. It doesn't guarantee production, but new permits often signal increased activity — and sometimes leasing interest — in your area.",
  },
  {
    id: "a2", tractId: "t1", recordType: "permit", wellType: "horizontal",
    title: "OAK BARREL 2-36-25-24XHW", operator: "Continental Resources", county: "Garvin",
    apiNumber: "35-049-20679", status: "Permit filed", eventDate: "2026-07-08", daysAgo: 8,
    explanation:
      "A second permit on the same pad. Operators frequently permit multiple horizontal wells together, which can indicate a larger development is planned nearby.",
  },
  {
    id: "a3", tractId: "t2", recordType: "well", wellType: "horizontal",
    title: "KURTZ 14_23-13N-11W 1HX", operator: "Devon Energy", county: "Kingfisher",
    apiNumber: "35-073-24515", status: "Spud", eventDate: "2026-06-30", daysAgo: 16,
    explanation:
      "“Spud” means drilling has physically begun. This is a step beyond permitting — an operator has committed a rig to the well near your interest.",
  },
  {
    id: "a4", tractId: "t4", recordType: "permit", wellType: "horizontal",
    title: "REDBUD 3-8-4S", operator: "Marathon Oil", county: "Lea",
    apiNumber: "30-025-41220", status: "Permit filed", eventDate: "2026-06-24", daysAgo: 22,
    explanation:
      "A new permit from a different operator in your county. Worth noting even if it isn't adjacent — it reflects where drilling attention is moving.",
  },
];

// ---- Accessors (swap these for Supabase queries when wiring real data) ---- //

/** Both the tract "active/quiet" status and the "Records found" stat claim a
 * 30-day recency window in their copy — this constant is what actually
 * enforces it, so the two can't silently drift apart again. */
const RECENT_ACTIVITY_WINDOW_DAYS = 30;

export interface TractSummary extends Tract {
  displayLabel: string;
  level: ActivityLevel;
  newActivityCount: number;
  latest?: ActivityEvent;
}

export function getTractSummaries(): TractSummary[] {
  return TRACTS.map((t) => {
    const events = ACTIVITY.filter(
      (a) => a.tractId === t.id && a.daysAgo <= RECENT_ACTIVITY_WINDOW_DAYS,
    ).sort((a, b) => a.daysAgo - b.daysAgo);
    return {
      ...t,
      displayLabel: getTractDisplayLabel(t),
      level: events.length > 0 ? "active" : "quiet",
      newActivityCount: events.length,
      latest: events[0],
    };
  });
}

export function getDashboardStats() {
  const tracts = TRACTS.length;
  const acres = TRACTS.reduce((sum, t) => sum + t.approxAcres, 0);
  const recent = ACTIVITY.filter((a) => a.daysAgo <= RECENT_ACTIVITY_WINDOW_DAYS);
  const newActivity = recent.length;
  const activeCounties = new Set(recent.map((a) => a.county)).size;
  return { tracts, acres, newActivity, activeCounties };
}

export interface ActivityEventWithState extends ActivityEvent {
  state: string;
}

export function getRecentActivity(): ActivityEventWithState[] {
  return [...ACTIVITY]
    .sort((a, b) => a.daysAgo - b.daysAgo)
    .map((a) => ({ ...a, state: TRACTS.find((t) => t.id === a.tractId)?.state ?? "" }));
}

export function getActivityById(id: string): ActivityEvent | undefined {
  return ACTIVITY.find((a) => a.id === id);
}

export function getTracts(): Tract[] {
  return TRACTS;
}

// ---- Plan / tier (mock — see STRATEGY.md pricing model: Tier 1 "you look it
// up" / Tier 2 "we watch it for you"). Display names below ("Explorer" /
// "Guardian") are working names from a design mockup, not finalized product
// copy — cheap to rename later. ---- //

export interface UserPlan {
  name: "Explorer" | "Guardian";
  tagline: string;
}

export function getUserPlan(): UserPlan {
  return { name: "Explorer", tagline: "Search public records and maps anytime." };
}

export const GUARDIAN_FEATURES = [
  {
    title: "Automatic monitoring",
    description: "We track permits, wells, and activity for you.",
  },
  {
    title: "Instant alerts",
    description: "Get notified the moment something happens.",
  },
  {
    title: "Summary reports",
    description: "Receive easy-to-read updates and insights.",
  },
] as const;
