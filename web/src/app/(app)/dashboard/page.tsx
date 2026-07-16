import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getTractSummaries,
  getDashboardStats,
  getRecentActivity,
} from "@/lib/mock-data";

function formatDaysAgo(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="font-heading text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const tracts = getTractSummaries();
  const stats = getDashboardStats();
  const recent = getRecentActivity();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
          My Mineral Interests
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening on and near your land.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Tracts tracked" value={stats.tracts} />
        <StatTile label="Total acres" value={stats.acres.toLocaleString()} />
        <StatTile label="New activity" value={stats.newActivity} />
        <StatTile label="Active counties" value={stats.activeCounties} />
      </div>

      <Separator className="my-8" />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="font-heading text-xl font-semibold text-foreground">Your tracts</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {tracts.map((tract) => (
              <Card key={tract.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                  <div>
                    <div className="font-heading text-base font-semibold text-foreground">
                      {tract.label}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tract.county} County, {tract.state} · {tract.approxAcres} acres
                    </div>
                  </div>
                  {tract.level === "active" ? (
                    <Badge className="bg-brand text-brand-foreground hover:bg-brand">
                      {tract.newActivityCount} new
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Quiet</Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {tract.latest ? (
                    <Link
                      href={`/activity/${tract.latest.id}`}
                      className="block rounded-lg bg-muted/60 px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                    >
                      <div className="font-medium text-foreground">{tract.latest.status}</div>
                      <div className="text-muted-foreground">
                        {tract.latest.operator} · {formatDaysAgo(tract.latest.daysAgo)}
                      </div>
                    </Link>
                  ) : (
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                      No recent drilling activity nearby.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground">Recent activity</h2>
          <div className="mt-4 flex flex-col gap-3">
            {recent.map((event) => (
              <Link
                key={event.id}
                href={`/activity/${event.id}`}
                className="rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-brand/40 hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{event.status}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDaysAgo(event.daysAgo)}
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {event.title} · {event.operator}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
