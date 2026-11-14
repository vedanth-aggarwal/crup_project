import { assertAdminPage } from "@/lib/server/session";
import { recentEvents } from "@/lib/server/admin-data";
import { EventsTable } from "@/components/admin/events-table";

export default async function AdminEventsPage() {
  await assertAdminPage();
  const events = await recentEvents();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl">Events</h1>
        <p className="text-sm text-muted-foreground">The 300 most recently updated events. Editing re-computes the search embedding.</p>
      </header>
      <EventsTable events={events} />
    </div>
  );
}
