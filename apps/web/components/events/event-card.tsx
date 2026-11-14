import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { PosterImage } from "./poster-image";
import { DateBadge } from "./date-badge";
import { TagChip, highlightTags } from "./chips";
import { BookmarkButton } from "./bookmark-button";
import { ClubAvatar } from "@/components/clubs/club-avatar";
import { countdown, formatWhen, isLive, relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { EventView } from "@/lib/types";

function Ribbon({ e }: { e: EventView }) {
  if (e.kind === "deadline" && e.deadlineAt) {
    const c = countdown(e.deadlineAt);
    if (c.level === "later" || c.level === "closed") return null;
    return (
      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm", c.level === "today" ? "bg-danger text-white" : "bg-warning text-gold-foreground")}>
        {c.label}
      </span>
    );
  }
  if (isLive(e.startAt, e.endAt)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        Happening now
      </span>
    );
  }
  if (e.startAt && relativeDay(e.startAt) === "Today") {
    return <span className="rounded-full bg-gold px-2.5 py-1 text-xs font-semibold text-gold-foreground shadow-sm">Today</span>;
  }
  return null;
}

export function EventCard({ event: e, priority }: { event: EventView; priority?: boolean }) {
  const when =
    e.kind === "deadline" && e.deadlineAt
      ? `Due ${formatWhen(e.deadlineAt, null, false)}`
      : formatWhen(e.startAt, e.endAt, e.allDay);
  const tags = highlightTags(e);
  return (
    <article className="group relative">
      <Link
        href={`/events/${e.id}`}
        scroll={false}
        className="block overflow-hidden rounded-lg border bg-card shadow-sm transition-[transform,box-shadow] duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-md focus-visible:-translate-y-0.5"
      >
        <div className="relative">
          <PosterImage
            event={e}
            priority={priority}
            imgClassName="transition-transform duration-300 ease-soft group-hover:scale-[1.03] motion-reduce:transform-none"
          />
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <DateBadge iso={e.kind === "deadline" && e.deadlineAt ? e.deadlineAt : e.sortAt} />
          </div>
          <div className="absolute bottom-3 left-3">
            <Ribbon e={e} />
          </div>
        </div>
        <div className="space-y-2 p-3.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ClubAvatar name={e.clubName} src={e.clubAvatarUrl} size={20} />
            <span className="truncate font-medium">{e.clubName}</span>
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-balance">{e.title}</h3>
          <dl className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">When</dt>
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <dd className="truncate">{when}</dd>
            </div>
            {(e.location?.name || e.location?.isOnline) && (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Where</dt>
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <dd className="truncate">{e.location.isOnline && !e.location.name ? "Online" : e.location.name}</dd>
              </div>
            )}
          </dl>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {tags.map((t) => (
                <TagChip key={t}>{t}</TagChip>
              ))}
            </div>
          )}
        </div>
      </Link>
      <BookmarkButton eventId={e.id} title={e.title} className="absolute right-3 top-3" />
    </article>
  );
}
