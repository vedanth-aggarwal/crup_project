import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Gift,
  ListChecks,
  MapPin,
  Mic,
  Repeat,
  Sparkles,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { PosterImage } from "./poster-image";
import { CategoryChip, TagChip } from "./chips";
import { BookmarkButton } from "./bookmark-button";
import { AddToCalendar } from "./add-to-calendar";
import { EventCard } from "./event-card";
import { ClubAvatar } from "@/components/clubs/club-avatar";
import { FollowButton } from "@/components/clubs/follow-button";
import { Button } from "@/components/ui/button";
import { countdown, formatWhen, longDateTime } from "@/lib/dates";
import { googleCalendarUrl } from "@/lib/calendar";
import type { EventView } from "@/lib/types";
import { appUrl } from "@/lib/app-url";
import { cn } from "@/lib/utils";

/**
 * Event page / modal. Structured facts come first so students never have to
 * read the poster; the poster is a supporting preview in the sidebar.
 */
export function EventDetail({ event: e, similar = [], compact }: { event: EventView; similar?: EventView[]; compact?: boolean }) {
  const d = e.details;
  const isDeadline = e.kind === "deadline";
  const when = isDeadline && e.deadlineAt ? `Due ${longDateTime(e.deadlineAt)}` : formatWhen(e.startAt, e.endAt, e.allDay);
  const dl = isDeadline && e.deadlineAt ? countdown(e.deadlineAt) : null;
  const primary = e.links?.rsvp
    ? { href: e.links.rsvp, label: "RSVP" }
    : e.links?.application
      ? { href: e.links.application, label: "Apply" }
      : e.links?.tickets
        ? { href: e.links.tickets, label: "Get tickets" }
        : null;
  const postUrl = e.sourcePostIds[0] ? `https://www.instagram.com/p/${e.sourcePostIds[0]}/` : null;
  const eventUrl = `${appUrl()}/events/${e.id}`;
  const cost = e.cost?.isFree ? "Free" : (e.cost?.price ?? null);
  const description = e.description && e.description.trim() !== e.summary.trim() ? e.description : null;

  return (
    <article className="space-y-8">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/clubs/${e.clubId}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ClubAvatar name={e.clubName} src={e.clubAvatarUrl} size={28} />
            {e.clubName}
          </Link>
          <FollowButton clubId={e.clubId} clubName={e.clubName} size="sm" />
        </div>
        <h1 className={cn("font-display leading-[1.05] text-balance", compact ? "text-4xl" : "text-4xl sm:text-5xl")}>{e.title}</h1>
        {e.summary && <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{e.summary}</p>}
        {(e.categories.length > 0 || d.partners.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {e.categories.map((c) => (
              <CategoryChip key={c} category={c} withEmoji />
            ))}
            {d.partners.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium">
                <Building2 className="size-3 text-muted-foreground" aria-hidden /> {p}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className={cn("grid gap-8", compact ? "lg:grid-cols-[minmax(0,1fr)_300px]" : "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        {/* Sidebar first in DOM order on phones: facts + actions are what people need first. */}
        <aside className="space-y-4 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <dl className="divide-y rounded-lg border bg-card text-sm">
            <Fact icon={Clock} label="When">
              <span className="font-medium">{when}</span>
              {dl && dl.level !== "later" && (
                <span
                  className={cn(
                    "mt-1 block w-fit rounded-full px-2 py-0.5 text-xs font-semibold",
                    dl.level === "today" || dl.level === "closed" ? "bg-danger/15 text-danger" : "bg-warning/20 text-foreground",
                  )}
                >
                  {dl.label}
                </span>
              )}
            </Fact>
            {e.recurrence && <Fact icon={Repeat} label="Repeats">{e.recurrence}</Fact>}
            {(e.location?.name || e.location?.isOnline) && (
              <Fact icon={MapPin} label="Where">
                <span className="font-medium">{e.location.name ?? "Online"}</span>
                {e.location.address && <span className="block text-muted-foreground">{e.location.address}</span>}
                {e.location.name && !e.location.isOnline && (
                  <a
                    className="mt-1 flex w-fit items-center gap-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.location.address ?? e.location.name}, Berkeley, CA`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Maps <ArrowUpRight className="size-3" aria-hidden />
                  </a>
                )}
              </Fact>
            )}
            {d.audience && <Fact icon={Users} label="Who it's for">{d.audience}</Fact>}
            {(cost || e.freeFood) && (
              <Fact icon={Wallet} label="Cost">
                {[cost, e.freeFood ? "🍕 Free food" : null].filter(Boolean).join(" · ")}
              </Fact>
            )}
            {d.rsvpRequired && <Fact icon={Ticket} label="RSVP">RSVP required</Fact>}
          </dl>

          <div className="flex flex-wrap gap-2">
            {primary && (
              <Button asChild size="lg" className="h-11 flex-1 rounded-full px-6">
                <a href={primary.href} target="_blank" rel="noopener noreferrer">
                  {primary.label} <ArrowUpRight aria-hidden />
                </a>
              </Button>
            )}
            <BookmarkButton eventId={e.id} title={e.title} variant="inline" />
            <AddToCalendar googleUrl={googleCalendarUrl(e, eventUrl)} icsUrl={`/api/events/${e.id}/ics`} />
          </div>

          {e.poster && (
            <figure className="space-y-2">
              <a href={e.poster.sizes.lg} target="_blank" rel="noopener noreferrer" className="group block" aria-label="Open the full poster">
                <PosterImage
                  event={e}
                  sizes="340px"
                  className="max-h-72 rounded-lg border lg:max-h-none"
                  imgClassName="transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </a>
              <figcaption className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Original poster</span>
                {postUrl && (
                  <a href={postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    <Camera className="size-3.5" aria-hidden /> View post
                  </a>
                )}
              </figcaption>
            </figure>
          )}
        </aside>

        {/* Main: structured details */}
        <div className="min-w-0 space-y-8 lg:order-1">
          {d.highlights.length > 0 && (
            <Section icon={Sparkles} title="Highlights">
              <ul className="grid gap-2 sm:grid-cols-2">
                {d.highlights.map((h) => (
                  <li key={h} className="flex gap-2 rounded-md border bg-card p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(description || (!d.highlights.length && e.summary)) && (
            <Section title="About">
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{description ?? e.summary}</p>
            </Section>
          )}

          {d.agenda.length > 0 && (
            <Section icon={Clock} title="Agenda">
              <ol className="relative space-y-3 border-l pl-5">
                {d.agenda.map((a, i) => (
                  <li key={i} className="relative text-sm">
                    <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-brand ring-4 ring-background" aria-hidden />
                    {a.time && <span className="mr-2 font-mono text-xs text-muted-foreground">{a.time}</span>}
                    {a.item}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {d.speakers.length > 0 && (
            <Section icon={Mic} title={d.speakers.length === 1 ? "Speaker" : "Speakers"}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {d.speakers.map((s) => (
                  <li key={s.name} className="flex items-center gap-3 rounded-md border bg-card p-3">
                    <ClubAvatar name={s.name} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      {s.role && <p className="truncate text-xs text-muted-foreground">{s.role}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(d.perks.length > 0 || d.requirements.length > 0) && (
            <div className="grid gap-6 sm:grid-cols-2">
              {d.perks.length > 0 && (
                <Section icon={Gift} title="Perks">
                  <BulletList items={d.perks} />
                </Section>
              )}
              {d.requirements.length > 0 && (
                <Section icon={ListChecks} title="Before you go">
                  <BulletList items={d.requirements} />
                </Section>
              )}
            </div>
          )}

          {(e.links?.info?.length ?? 0) > 0 && (
            <Section title="Links">
              <ul className="space-y-1 text-sm">
                {e.links.info.map((u) => (
                  <li key={u}>
                    <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all underline-offset-2 hover:underline">
                      {u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)} <ArrowUpRight className="size-3 shrink-0" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {e.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {e.tags.map((t) => (
                <TagChip key={t}>{t}</TagChip>
              ))}
            </div>
          )}

          {similar.length > 0 && (
            <section className="space-y-4 border-t pt-6">
              <h2 className="font-display text-2xl">You might also like</h2>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {similar.slice(0, compact ? 2 : 3).map((s) => (
                  <EventCard key={s.id} event={s} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}

function Fact({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-3.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon?: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-4" aria-hidden />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((p) => (
        <li key={p} className="flex gap-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
          {p}
        </li>
      ))}
    </ul>
  );
}
