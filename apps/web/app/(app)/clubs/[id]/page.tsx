import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, Globe } from "lucide-react";
import { ClubAvatar } from "@/components/clubs/club-avatar";
import { FollowButton } from "@/components/clubs/follow-button";
import { CategoryChip } from "@/components/events/chips";
import { EventGrid } from "@/components/events/event-grid";
import { EmptyState } from "@/components/brand/empty-state";
import { getClub, listPastClubEvents, listUpcomingEvents, withClubInfo } from "@/lib/server/data";

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps<"/clubs/[id]">): Promise<Metadata> {
  const club = await getClub((await params).id);
  return { title: club?.name ?? "Club not found", description: club?.description ?? undefined };
}

export default async function ClubPage({ params }: PageProps<"/clubs/[id]">) {
  const { id } = await params;
  const club = await getClub(id);
  if (!club) notFound();
  const [upcoming, past] = await Promise.all([
    listUpcomingEvents().then((all) => withClubInfo(all.filter((e) => e.clubId === id))),
    listPastClubEvents(id).then(withClubInfo),
  ]);
  // Banner tinted from the club's posters' main colours.
  const colors = [...upcoming, ...past].map((e) => e.poster?.dominantColor).filter(Boolean).slice(0, 3) as string[];
  const banner = colors.length >= 2 ? `linear-gradient(120deg, ${colors.join(", ")})` : undefined;

  return (
    <div className="space-y-10">
      <header className="overflow-hidden rounded-xl border bg-card">
        <div className="h-28 bg-gradient-to-r from-brand to-brand/70 sm:h-36" style={banner ? { background: banner } : undefined} />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-8">
          <ClubAvatar name={club.name} src={club.avatarUrl} size={88} className="-mt-11 ring-4 ring-card" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="font-display text-4xl leading-tight">{club.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <a href={`https://www.instagram.com/${club.igHandle}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                @{club.igHandle} <ArrowUpRight className="size-3" aria-hidden />
              </a>
              {club.website && (
                <a href={club.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  <Globe className="size-3.5" aria-hidden /> Website
                </a>
              )}
              <span>{upcoming.length} upcoming · {club.stats.eventsFound} total events</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {club.category.map((c) => <CategoryChip key={c} category={c} withEmoji />)}
            </div>
          </div>
          <FollowButton clubId={club.id} clubName={club.name} size="lg" />
        </div>
        {club.description && <p className="max-w-2xl px-5 pb-6 text-sm text-muted-foreground sm:px-8">{club.description}</p>}
      </header>

      <section className="space-y-4" aria-labelledby="up-h">
        <h2 id="up-h" className="font-display text-3xl">Upcoming</h2>
        {upcoming.length ? <EventGrid events={upcoming} priorityCount={4} /> : <EmptyState title="Nothing scheduled" description={`Follow ${club.name} and we'll email you when they post an event.`} />}
      </section>
      {past.length > 0 && (
        <section className="space-y-4" aria-labelledby="past-h">
          <h2 id="past-h" className="font-display text-3xl text-muted-foreground">Past events</h2>
          <EventGrid events={past} className="opacity-80" />
        </section>
      )}
    </div>
  );
}
