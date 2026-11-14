import { CATEGORY_META, type Category } from "@clubo/shared";
import { cn } from "@/lib/utils";

export function CategoryChip({ category, className, withEmoji }: { category: Category; className?: string; withEmoji?: boolean }) {
  const m = CATEGORY_META[category];
  return (
    <span
      className={cn("cat-chip inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      style={{ "--hue": m.hue } as React.CSSProperties}
    >
      {withEmoji && <span aria-hidden>{m.emoji}</span>}
      {category}
    </span>
  );
}

export function TagChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground", className)}>
      {children}
    </span>
  );
}

/** Up to 3 highlight chips for a card: free food, free, then free-form tags. */
export function highlightTags(e: { freeFood: boolean; cost: { isFree: boolean | null }; tags: string[]; location: { isOnline: boolean } }) {
  const out: string[] = [];
  if (e.freeFood) out.push("🍕 Free food");
  if (e.cost?.isFree) out.push("Free");
  if (e.location?.isOnline) out.push("Online");
  for (const t of e.tags) {
    if (out.length >= 3) break;
    if (/free food|^free$|online/i.test(t)) continue;
    out.push(t);
  }
  return out.slice(0, 3);
}
