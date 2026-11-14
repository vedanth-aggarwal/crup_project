import { cn } from "@/lib/utils";

/** Friendly empty/error state: a pinned-poster illustration plus a next step. */
export function EmptyState({
  title,
  description,
  action,
  tone = "empty",
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "empty" | "error";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)} role={tone === "error" ? "alert" : undefined}>
      <BoardArt tone={tone} />
      <h2 className="mt-6 font-display text-3xl">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function BoardArt({ tone }: { tone: "empty" | "error" }) {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden className="text-muted-foreground">
      <rect x="6" y="10" width="108" height="80" rx="10" className="fill-muted" />
      <g transform="rotate(-6 40 50)">
        <rect x="22" y="24" width="34" height="42" rx="4" className="fill-card stroke-border" strokeWidth="1.5" />
        <rect x="27" y="30" width="24" height="16" rx="2" className={tone === "error" ? "fill-danger/30" : "fill-brand/15"} />
        <rect x="27" y="50" width="18" height="3" rx="1.5" className="fill-border" />
        <rect x="27" y="56" width="12" height="3" rx="1.5" className="fill-border" />
        <circle cx="39" cy="24" r="3" className="fill-gold" />
      </g>
      <g transform="rotate(5 82 46)">
        <rect x="66" y="22" width="32" height="40" rx="4" className="fill-card stroke-border" strokeWidth="1.5" strokeDasharray={tone === "empty" ? "4 3" : undefined} />
        <circle cx="82" cy="22" r="3" className="fill-gold" />
      </g>
    </svg>
  );
}
