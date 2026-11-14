import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ClubAvatar } from "@/components/clubs/club-avatar";
import { BookmarkButton } from "./bookmark-button";
import { countdown, longDateTime } from "@/lib/dates";
import type { EventView } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVEL_STYLES = {
  today: "bg-danger text-white",
  soon: "bg-warning text-gold-foreground",
  later: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground line-through",
} as const;

export function DeadlineList({ events }: { events: EventView[] }) {
  return (
    <ol className="divide-y overflow-hidden rounded-lg border bg-card">
      {events.map((e) => {
        const c = countdown(e.deadlineAt!);
        const action = e.links.application ?? e.links.rsvp ?? e.links.tickets;
        return (
          <li key={e.id} className="relative flex items-center gap-4 p-4 transition-colors hover:bg-accent/50">
            <span className={cn("hidden w-32 shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-semibold sm:block", LEVEL_STYLES[c.level])}>
              {c.label}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/events/${e.id}`} scroll={false} className="font-semibold after:absolute after:inset-0 hover:underline">
                {e.title}
              </Link>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <ClubAvatar name={e.clubName} src={e.clubAvatarUrl} size={16} />
                <span className="truncate">{e.clubName} · Due {longDateTime(e.deadlineAt!)}</span>
              </p>
              <span className={cn("mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold sm:hidden", LEVEL_STYLES[c.level])}>{c.label}</span>
            </div>
            {action && (
              <a
                href={action}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 hidden items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-accent sm:inline-flex"
              >
                {e.links.application ? "Apply" : e.links.rsvp ? "RSVP" : "Tickets"} <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            )}
            <BookmarkButton eventId={e.id} title={e.title} variant="inline" className="relative z-10" />
          </li>
        );
      })}
    </ol>
  );
}
