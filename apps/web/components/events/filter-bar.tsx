"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X, Search } from "lucide-react";
import { CATEGORIES, CATEGORY_META, type Category } from "@clubo/shared";
import {
  DATE_PRESETS,
  DATE_PRESET_LABELS,
  EMPTY_FILTERS,
  activeFilterCount,
  filtersToSearch,
  parseFilters,
  type Filters,
} from "@/lib/filters";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function Chip({ active, onClick, children, style }: { active: boolean; onClick: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={style}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
        active ? "border-transparent bg-foreground text-background" : "bg-card text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({ signedIn, total }: { signedIn: boolean; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = parseFilters(new URLSearchParams(params.toString()));
  const [q, setQ] = useState(f.q);
  const [pending, start] = useTransition();

  const set = (patch: Partial<Filters>) =>
    start(() => router.replace(`${pathname}${filtersToSearch({ ...f, ...patch })}`, { scroll: false }));

  // Debounced text search.
  useEffect(() => {
    if (q === f.q) return;
    const t = setTimeout(() => set({ q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const toggleCat = (c: Category) =>
    set({ categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] });

  const extra = +f.freeFood + +f.free + +(f.mode !== "any") + +f.following;
  const count = activeFilterCount(f);

  return (
    <div className="sticky top-16 z-30 -mx-4 border-b bg-background/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6" data-pending={pending || undefined}>
      <div className="flex items-center gap-2">
        <label className="relative flex-1 sm:max-w-xs">
          <span className="sr-only">Search events</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events"
            className="h-9 w-full rounded-full border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-9 rounded-full">
              <SlidersHorizontal aria-hidden />
              <span className="hidden sm:inline">More filters</span>
              {extra > 0 && <span className="rounded-full bg-foreground px-1.5 text-[11px] text-background">{extra}</span>}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>{total} events match right now.</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4">
              {[
                { id: "food", label: "🍕 Free food", on: f.freeFood, set: (v: boolean) => set({ freeFood: v }) },
                { id: "free", label: "Free entry", on: f.free, set: (v: boolean) => set({ free: v }) },
                ...(signedIn
                  ? [{ id: "following", label: "From clubs & categories I follow", on: f.following, set: (v: boolean) => set({ following: v }) }]
                  : []),
              ].map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-4">
                  <Label htmlFor={`f-${o.id}`} className="text-sm">{o.label}</Label>
                  <Switch id={`f-${o.id}`} checked={o.on} onCheckedChange={o.set} />
                </div>
              ))}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Format</legend>
                <div className="flex gap-2">
                  {(["any", "in-person", "online"] as const).map((m) => (
                    <Chip key={m} active={f.mode === m} onClick={() => set({ mode: m })}>
                      {m === "any" ? "Any" : m === "online" ? "Online" : "In person"}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </div>
            <SheetFooter>
              <Button variant="ghost" onClick={() => { setQ(""); set(EMPTY_FILTERS); }}>Clear all</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        {count > 0 && (
          <Button variant="ghost" size="sm" className="h-9 rounded-full" onClick={() => { setQ(""); set(EMPTY_FILTERS); }}>
            <X aria-hidden /> Clear
          </Button>
        )}
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:-mx-6 sm:px-6" role="group" aria-label="Quick filters">
        {DATE_PRESETS.map((d) => (
          <Chip key={d} active={f.date === d} onClick={() => set({ date: d })}>
            {DATE_PRESET_LABELS[d]}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-border" aria-hidden />
        {CATEGORIES.map((c) => (
          <Chip key={c} active={f.categories.includes(c)} onClick={() => toggleCat(c)}>
            <span aria-hidden>{CATEGORY_META[c].emoji}</span>
            {c}
          </Chip>
        ))}
      </div>
    </div>
  );
}
