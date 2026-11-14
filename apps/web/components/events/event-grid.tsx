import { EventCard } from "./event-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventView } from "@/lib/types";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 sm:gap-5";

export function EventGrid({ events, priorityCount = 0, className }: { events: EventView[]; priorityCount?: number; className?: string }) {
  return (
    <div className={cn(GRID, className)}>
      {events.map((e, i) => (
        <EventCard key={e.id} event={e} priority={i < priorityCount} />
      ))}
    </div>
  );
}

/** Skeleton cards with the same shape as real ones (§13.4). */
export function EventGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID} aria-busy="true" aria-label="Loading events">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border bg-card">
          <Skeleton className="aspect-[4/5] rounded-none" />
          <div className="space-y-2.5 p-3.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
