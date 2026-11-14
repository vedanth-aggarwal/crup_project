import { notFound } from "next/navigation";
import { EventDetail } from "@/components/events/event-detail";
import { EventModal } from "@/components/events/event-modal";
import { getEvent, withClubInfo } from "@/lib/server/data";
import { similarEvents } from "@/lib/server/similar";

export default async function EventModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await getEvent(id);
  if (!raw || raw.status !== "published") notFound();
  const [[event], similar] = await Promise.all([withClubInfo([raw]), similarEvents(raw, 2)]);
  return (
    <EventModal title={event!.title}>
      <EventDetail event={event!} similar={similar} compact />
    </EventModal>
  );
}
