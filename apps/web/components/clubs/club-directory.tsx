"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES, CATEGORY_META, type Category } from "@clubo/shared";
import { ClubCard } from "./club-card";
import { EmptyState } from "@/components/brand/empty-state";
import { cn } from "@/lib/utils";
import type { ClubView } from "@/lib/types";

export function ClubDirectory({ clubs }: { clubs: ClubView[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const shown = useMemo(() => {
    const lq = q.toLowerCase();
    return clubs.filter(
      (c) =>
        (!cat || c.category.includes(cat)) &&
        (!lq || c.name.toLowerCase().includes(lq) || c.igHandle.includes(lq) || c.description?.toLowerCase().includes(lq)),
    );
  }, [clubs, q, cat]);
  const used = CATEGORIES.filter((c) => clubs.some((x) => x.category.includes(c)));
  return (
    <div className="space-y-5">
      <label className="relative block max-w-md">
        <span className="sr-only">Search clubs</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${clubs.length} clubs`}
          className="h-11 w-full rounded-full border bg-card pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filter by category">
        {[null, ...used].map((c) => (
          <button
            key={c ?? "all"}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
              cat === c ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-accent",
            )}
          >
            {c ? <><span aria-hidden>{CATEGORY_META[c].emoji}</span>{c}</> : "All"}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <ClubCard key={c.id} club={c} />
          ))}
        </div>
      ) : (
        <EmptyState title="No clubs match" description="Try another name or category." />
      )}
    </div>
  );
}
