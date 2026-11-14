import Link from "next/link";
import { BookmarkButton } from "@/components/events/bookmark-button";
import { formatWhen } from "@/lib/dates";
import type { EventView } from "@/lib/types";

/** Compact horizontal event card used inside chat answers. */
export function InlineEventCard({ event: e }: { event: EventView }) {
  const when = e.kind === "deadline" && e.deadlineAt ? `Due ${formatWhen(e.deadlineAt, null, false)}` : formatWhen(e.startAt, e.endAt, e.allDay);
  return (
    <article className="relative flex gap-3 rounded-lg border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md bg-muted" style={{ backgroundColor: e.poster?.dominantColor }}>
        {e.poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.poster.sizes.sm} alt="" className="size-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate text-xs text-muted-foreground">{e.clubName}</p>
        <Link href={`/events/${e.id}`} scroll={false} className="line-clamp-2 text-sm font-semibold leading-snug after:absolute after:inset-0 hover:underline">
          {e.title}
        </Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">{when}</p>
        {e.location?.name && <p className="truncate text-xs text-muted-foreground">{e.location.name}</p>}
      </div>
      <BookmarkButton eventId={e.id} title={e.title} variant="inline" className="relative z-10 size-9 shrink-0 self-start" />
    </article>
  );
}
