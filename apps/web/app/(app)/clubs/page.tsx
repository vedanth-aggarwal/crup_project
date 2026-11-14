import type { Metadata } from "next";
import { ClubDirectory } from "@/components/clubs/club-directory";
import { EmptyState } from "@/components/brand/empty-state";
import { listClubs, listUpcomingEvents } from "@/lib/server/data";

export const metadata: Metadata = { title: "Clubs" };
export const revalidate = 600;

export default async function ClubsPage() {
  const [clubs, events] = await Promise.all([listClubs(), listUpcomingEvents()]);
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.clubId, (counts.get(e.clubId) ?? 0) + 1);
  const withCounts = clubs
    .filter((c) => c.active)
    .map((c) => ({ ...c, upcomingCount: counts.get(c.id) ?? 0 }))
    .sort((a, b) => b.upcomingCount - a.upcomingCount || a.name.localeCompare(b.name));
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-5xl">Clubs</h1>
        <p className="text-muted-foreground">Follow clubs to see their events first and get an email when they post something new.</p>
      </header>
      {withCounts.length ? <ClubDirectory clubs={withCounts} /> : <EmptyState title="No clubs yet" description="Clubs show up here once an admin adds them." />}
    </div>
  );
}
