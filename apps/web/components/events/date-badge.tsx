import { dateBadge } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function DateBadge({ iso, className }: { iso: string; className?: string }) {
  const b = dateBadge(iso);
  return (
    <div
      className={cn(
        "flex min-w-12 flex-col items-center rounded-md bg-card/95 px-2 py-1 font-mono leading-none text-foreground shadow-sm backdrop-blur",
        className,
      )}
      aria-hidden
    >
      <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">{b.dow}</span>
      <span className="text-lg font-semibold">{b.day}</span>
    </div>
  );
}
