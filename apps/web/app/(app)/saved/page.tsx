import type { Metadata } from "next";
import Link from "next/link";
import { SavedView } from "@/components/events/saved-view";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/server/session";
import { getEventsByIds, getUserView, withClubInfo } from "@/lib/server/data";
import type { EventView } from "@/lib/types";

/** Hide events that ended more than 3h ago. */
function notPast(events: EventView[]) {
  const cutoff = Date.now() - 3 * 3600_000;
  return events.filter((e) => new Date(e.sortAt).getTime() > cutoff);
}

export const metadata: Metadata = { title: "Saved" };

export default async function SavedPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <EmptyState
        title="Save events you like"
        description="Tap the heart on any event and it lands here, with a reminder email before it starts."
        action={<Button asChild className="rounded-full"><Link href="/login?next=/saved">Sign in</Link></Button>}
      />
    );
  }
  const view = await getUserView(user.uid);
  const events = await getEventsByIds(view?.bookmarkIds ?? []).then(withClubInfo);
  const upcoming = notPast(events).sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-5xl">Saved</h1>
        <p className="text-muted-foreground">We&rsquo;ll email you before these start. Change that in Settings.</p>
      </header>
      {upcoming.length ? (
        <SavedView events={upcoming} />
      ) : (
        <EmptyState
          title="Nothing saved yet"
          description="Bookmark events to see them here."
          action={<Button asChild variant="outline" className="rounded-full"><Link href="/">Browse events</Link></Button>}
        />
      )}
    </div>
  );
}
