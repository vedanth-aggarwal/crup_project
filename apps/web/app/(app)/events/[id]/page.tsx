import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/events/event-detail";
import { getEvent, withClubInfo } from "@/lib/server/data";
import { similarEvents } from "@/lib/server/similar";
import { formatWhen } from "@/lib/dates";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const e = await getEvent(id);
  if (!e) return { title: "Event not found" };
  const desc = `${formatWhen(e.startAt, e.endAt, e.allDay)} · ${e.clubName}. ${e.summary}`;
  return {
    title: e.title,
    description: desc,
    openGraph: { title: e.title, description: desc, images: e.poster ? [{ url: e.poster.sizes.lg }] : undefined },
    twitter: { card: "summary_large_image" },
  };
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const raw = await getEvent(id);
  if (!raw || raw.status !== "published") notFound();
  const [[event], similar] = await Promise.all([withClubInfo([raw]), similarEvents(raw)]);
  return <EventDetail event={event!} similar={similar} />;
}
