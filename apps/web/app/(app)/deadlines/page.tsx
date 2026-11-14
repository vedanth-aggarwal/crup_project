import type { Metadata } from "next";
import { DeadlineList } from "@/components/events/deadline-list";
import { EmptyState } from "@/components/brand/empty-state";
import { listUpcomingEvents, withClubInfo } from "@/lib/server/data";

export const metadata: Metadata = { title: "Deadlines" };
export const revalidate = 300;

export default async function DeadlinesPage() {
  const all = await listUpcomingEvents().then(withClubInfo);
  const deadlines = all
    .filter((e) => e.kind === "deadline" && e.deadlineAt && new Date(e.deadlineAt) > new Date())
    .sort((a, b) => a.deadlineAt!.localeCompare(b.deadlineAt!));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-5xl">Deadlines</h1>
        <p className="text-muted-foreground">Applications, RSVPs, and ticket sales closing soon, most urgent first.</p>
      </header>
      {deadlines.length ? (
        <DeadlineList events={deadlines} />
      ) : (
        <EmptyState title="Nothing due right now" description="When clubs post application or RSVP deadlines, they'll line up here." />
      )}
    </div>
  );
}
