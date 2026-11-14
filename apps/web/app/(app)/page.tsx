import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { FilterBar } from "@/components/events/filter-bar";
import { EventGrid } from "@/components/events/event-grid";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { listUpcomingEvents, listRecentPastEvents, getUserView, withClubInfo } from "@/lib/server/data";
import { getSessionUser } from "@/lib/server/session";
import { applyFilters, activeFilterCount, parseFilters } from "@/lib/filters";
import { GROUP_LABELS, fullDate, timeGroup, type TimeGroup } from "@/lib/dates";
import type { EventView } from "@/lib/types";

export const revalidate = 300;

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" }).format(now));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function FeedPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const user = await getSessionUser();
  const [all, pastAll, view] = await Promise.all([
    listUpcomingEvents().then(withClubInfo),
    listRecentPastEvents().then(withClubInfo),
    user ? getUserView(user.uid).catch(() => null) : null,
  ]);
  const events = all.filter((e) => e.kind === "event");
  const filtered = applyFilters(events, filters, {
    followedClubs: view?.followedClubs,
    followedCategories: view?.followedCategories,
  });
  // Past events only make sense for the "Anytime" view; other date chips look forward.
  const past =
    filters.date === "all"
      ? applyFilters(
          pastAll.filter((e) => e.kind === "event"),
          filters,
          { followedClubs: view?.followedClubs, followedCategories: view?.followedCategories },
        )
      : [];
  const weekCount = events.filter((e) => e.startAt && timeGroup(e.startAt, e.endAt) !== "later").length;
  const clubCount = new Set(events.map((e) => e.clubId)).size;
  const followed = view
    ? events.filter((e) => view.followedClubs.includes(e.clubId)).slice(0, 4)
    : [];
  const filtering = activeFilterCount(filters) > 0;

  return (
    <div className="space-y-8">
      {user ? (
        <section className="space-y-1">
          <p className="text-sm text-muted-foreground">{fullDate(new Date().toISOString())}</p>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            {greeting()}{view?.name ? `, ${view.name.split(" ")[0]}` : ""}.
          </h1>
        </section>
      ) : (
        <Hero weekCount={weekCount} clubCount={clubCount} posters={events.filter((e) => e.poster).slice(0, 6)} />
      )}

      {!filtering && followed.length > 0 && (
        <section aria-labelledby="following-h" className="space-y-4">
          <SectionHeader id="following-h" title="From clubs you follow" href="/?following=1" />
          <EventGrid events={followed} />
        </section>
      )}

      <Suspense>
        <FilterBar signedIn={!!user} total={filtered.length + past.length} />
      </Suspense>

      {events.length === 0 && past.length === 0 ? (
        <EmptyState
          title="The board is empty (for now)"
          description="We haven't pulled any club events yet. Once clubs are added and scraped, they'll show up here."
        />
      ) : filtered.length === 0 && past.length === 0 ? (
        <EmptyState
          title="No events match"
          description="Try a different date or fewer categories."
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          {filtered.length > 0 ? (
            <GroupedEvents events={filtered} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing coming up that matches. Here&rsquo;s what happened recently.</p>
          )}
          {past.length > 0 && (
            <section aria-labelledby="g-past" className="space-y-4 border-t pt-8">
              <h2 id="g-past" className="flex items-baseline gap-3 font-display text-3xl">
                Past month
                <span className="font-sans text-sm text-muted-foreground">{past.length}</span>
              </h2>
              <EventGrid events={past} className="opacity-90" />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function GroupedEvents({ events }: { events: EventView[] }) {
  const groups = new Map<TimeGroup, EventView[]>();
  for (const e of events) {
    const g = e.startAt ? timeGroup(e.startAt, e.endAt) : "later";
    groups.set(g, [...(groups.get(g) ?? []), e]);
  }
  let rendered = 0;
  return (
    <div className="space-y-10">
      {(["now", "today", "week", "later"] as const).map((g) => {
        const list = groups.get(g);
        if (!list?.length) return null;
        const priority = Math.max(0, 4 - rendered);
        rendered += list.length;
        return (
          <section key={g} aria-labelledby={`g-${g}`} className="space-y-4">
            <h2 id={`g-${g}`} className="flex items-baseline gap-3 font-display text-3xl">
              {GROUP_LABELS[g]}
              <span className="font-sans text-sm text-muted-foreground">{list.length}</span>
            </h2>
            <EventGrid events={list} priorityCount={priority} />
          </section>
        );
      })}
    </div>
  );
}

function SectionHeader({ id, title, href }: { id: string; title: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 id={id} className="font-display text-3xl">{title}</h2>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        See all <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function Hero({ weekCount, clubCount, posters }: { weekCount: number; clubCount: number; posters: EventView[] }) {
  return (
    <section className="relative overflow-hidden rounded-xl border bg-card px-6 py-12 shadow-sm sm:px-10 sm:py-16">
      <div className="relative z-10 max-w-xl space-y-5">
        <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-gold" aria-hidden />
          {weekCount > 0 ? `${weekCount} events this week from ${clubCount} clubs` : "Every Berkeley club, one board"}
        </p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
          What&rsquo;s happening <em className="text-brand">at Berkeley</em>
        </h1>
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">
          Every club event in one place, pulled straight from club Instagram posts. Save the ones you like and get a reminder before they start.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/signup">Create a free account</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-6">
            <Link href="/chat">
              <Sparkles className="text-gold" aria-hidden /> Ask Clubo
            </Link>
          </Button>
        </div>
      </div>
      {posters.length > 0 && (
        <div className="pointer-events-none absolute -right-10 top-1/2 hidden -translate-y-1/2 lg:flex lg:gap-4" aria-hidden>
          {posters.slice(0, 3).map((e, i) => (
            <div
              key={e.id}
              className="aspect-[4/5] w-44 overflow-hidden rounded-lg border bg-muted shadow-lg"
              style={{ transform: `rotate(${[-6, 3, -2][i]}deg) translateY(${[0, -24, 16][i]}px)`, backgroundColor: e.poster?.dominantColor }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.poster!.sizes.md} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
