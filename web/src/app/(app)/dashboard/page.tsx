import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StateOutline } from "@/components/state-outline";
import {
  getTractSummaries,
  getDashboardStats,
  getRecentActivity,
  getUserPlan,
  formatEventDate,
  GUARDIAN_FEATURES,
} from "@/lib/mock-data";
import {
  Map as MapIcon,
  Search,
  List,
  Upload,
  Lock,
  ArrowRight,
} from "lucide-react";

function formatDaysAgo(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

// Decorative per-tract accent color (cycled by index) — purely visual variety,
// tied to the tract's real `state` field for the icon, not to status or any
// parcel-level geometry we don't have. See design/dashboard-brief.md.
const TRACT_ACCENTS = [
  { fg: "text-orange-600", bg: "bg-orange-50" },
  { fg: "text-emerald-600", bg: "bg-emerald-50" },
  { fg: "text-violet-600", bg: "bg-violet-50" },
  { fg: "text-blue-600", bg: "bg-blue-50" },
];

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className={"size-2 rounded-full " + (active ? "bg-brand" : "bg-muted-foreground/40")} />
      {label}
    </span>
  );
}

function StatTile({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="font-heading text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
      {sublabel && <div className="text-xs text-muted-foreground/70">{sublabel}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const tracts = getTractSummaries();
  const stats = getDashboardStats();
  const recent = getRecentActivity();
  const plan = getUserPlan();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
          Good morning, James
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your mineral interests.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">My Tracts</h2>
              <p className="text-sm text-muted-foreground">Your mineral interests at a glance.</p>
            </div>
            <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
              View all tracts →
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {tracts.map((tract, i) => {
              const accent = TRACT_ACCENTS[i % TRACT_ACCENTS.length];
              return (
              <Card key={tract.id} className="overflow-hidden border-border py-0 shadow-sm">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-3 sm:w-60 sm:shrink-0">
                    <span className={`flex size-14 shrink-0 items-center justify-center rounded-lg ${accent.bg} p-2`}>
                      <StateOutline state={tract.state} className={`size-full ${accent.fg}`} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-heading text-base font-semibold text-foreground">
                        {tract.displayLabel}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {tract.county} County, {tract.state}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-6 text-sm sm:w-64 sm:shrink-0">
                    <div>
                      <div className="text-xs text-muted-foreground">Acres</div>
                      <div className="font-medium text-foreground">
                        {tract.approxAcres.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Interest</div>
                      <div className="font-medium text-foreground capitalize">
                        {tract.interestType === "npri" ? "NPRI" : tract.interestType}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Operator</div>
                      <div className="truncate font-medium text-foreground">
                        {tract.operator ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    {tract.level === "active" && tract.latest ? (
                      <>
                        <StatusDot active label="Recent activity" />
                        <div className="mt-1 font-medium text-foreground">
                          {tract.latest.status}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatEventDate(tract.latest.eventDate)}
                        </div>
                        <Link
                          href={`/activity/${tract.latest.id}`}
                          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          View details <ArrowRight className="size-3.5" />
                        </Link>
                      </>
                    ) : (
                      <>
                        <StatusDot active={false} label="No recent activity" />
                        <div className="mt-1 font-medium text-foreground">Quiet</div>
                        <div className="text-sm text-muted-foreground">In the last 30 days</div>
                        <Link
                          href="/dashboard"
                          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          View details <ArrowRight className="size-3.5" />
                        </Link>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Tracts" sublabel="You're tracking" value={stats.tracts} />
            <StatTile label="Total acres" sublabel="Approximate" value={stats.acres.toLocaleString()} />
            <StatTile label="Counties" sublabel="With activity" value={stats.activeCounties} />
            <StatTile label="Records found" sublabel="In last 30 days" value={stats.newActivity} />
          </div>

          <Separator className="my-8" />

          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">
                Recent activity
              </h2>
              <p className="text-sm text-muted-foreground">
                The latest updates across your tracts.
              </p>
            </div>
            <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
              View all activity →
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Activity</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">County</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((event) => (
                  <tr key={event.id} className="transition-colors hover:bg-accent">
                    <td className="px-4 py-3">
                      <Link href={`/activity/${event.id}`} className="block">
                        <div className="font-medium text-foreground">{event.status}</div>
                        <div className="text-muted-foreground">
                          {event.title} · {event.operator}
                        </div>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {event.county}, {event.state}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDaysAgo(event.daysAgo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Explore activity your way
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Search public records or explore activity on the map.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="flex flex-1 items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <Search className="size-4 text-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Search activity</div>
                  <div className="text-xs text-muted-foreground">Find permits, wells, and more.</div>
                </div>
              </Link>
              <Link
                href="/map"
                className="flex flex-1 items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <MapIcon className="size-4 text-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Explore map</div>
                  <div className="text-xs text-muted-foreground">
                    See activity on the map around your tracts.
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          <Card className="border-border">
            <CardContent className="p-5">
              <Badge variant="secondary" className="text-[10px] font-semibold tracking-wide uppercase">
                Your plan
              </Badge>
              <div className="mt-2 font-heading text-lg font-semibold text-foreground">
                {plan.name} Plan
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

              <Separator className="my-4" />

              <div className="text-sm font-medium text-foreground">Upgrade to Guardian</div>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll automatically monitor your tracts and alert you to important activity.
              </p>
              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                <Lock className="size-3.5" />
                Upgrade to Guardian
              </button>
              <Link
                href="/dashboard"
                className="mt-2 block text-center text-sm font-medium text-primary hover:underline"
              >
                Learn more about Guardian
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5">
              <div className="font-heading text-base font-semibold text-foreground">
                Quick actions
              </div>
              <div className="mt-3 flex flex-col">
                {[
                  { icon: Search, label: "Search activity", href: "/dashboard" },
                  { icon: MapIcon, label: "Explore on map", href: "/map" },
                  { icon: List, label: "View my tracts", href: "/dashboard" },
                  { icon: Upload, label: "Upload a document", href: "/dashboard" },
                ].map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <span className="flex items-center gap-2.5 text-foreground">
                      <action.icon className="size-4 text-muted-foreground" />
                      {action.label}
                    </span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5">
              <div className="font-heading text-base font-semibold text-foreground">
                Guardian includes
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {GUARDIAN_FEATURES.map((f) => (
                  <div key={f.title} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">{f.title}</div>
                      <div className="text-sm text-muted-foreground">{f.description}</div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      Premium
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
