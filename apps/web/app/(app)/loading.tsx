import { EventGridSkeleton } from "@/components/events/event-grid";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-72" />
      </div>
      <EventGridSkeleton />
    </div>
  );
}
