import { CATEGORIES, CATEGORY_META, categoryFromSlug, type Category } from "@clubo/shared";
import type { EventView } from "./types";
import { ptDayKey, ptWeekday, startOfPtDay } from "./dates";

export const DATE_PRESETS = ["all", "today", "week", "weekend"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];
export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "Anytime",
  today: "Today",
  week: "This week",
  weekend: "Weekend",
};

export type Filters = {
  date: DatePreset;
  categories: Category[];
  clubs: string[];
  freeFood: boolean;
  free: boolean;
  mode: "any" | "online" | "in-person";
  following: boolean;
  q: string;
};

export const EMPTY_FILTERS: Filters = {
  date: "all",
  categories: [],
  clubs: [],
  freeFood: false,
  free: false,
  mode: "any",
  following: false,
  q: "",
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;
const get = (p: Params, k: string): string | undefined => {
  if (p instanceof URLSearchParams) return p.get(k) ?? undefined;
  const v = p[k];
  return Array.isArray(v) ? v[0] : v;
};

/** Filters live in the URL so a filtered view can be shared (§13.3). */
export function parseFilters(p: Params): Filters {
  const date = get(p, "date") as DatePreset | undefined;
  const mode = get(p, "mode");
  return {
    date: date && DATE_PRESETS.includes(date) ? date : "all",
    categories: (get(p, "cat") ?? "").split(",").map(categoryFromSlug).filter((c): c is Category => !!c),
    clubs: (get(p, "club") ?? "").split(",").filter(Boolean),
    freeFood: get(p, "food") === "1",
    free: get(p, "free") === "1",
    mode: mode === "online" || mode === "in-person" ? mode : "any",
    following: get(p, "following") === "1",
    q: (get(p, "q") ?? "").slice(0, 100),
  };
}

export function filtersToSearch(f: Filters): string {
  const s = new URLSearchParams();
  if (f.date !== "all") s.set("date", f.date);
  if (f.categories.length) s.set("cat", f.categories.map((c) => CATEGORY_META[c].slug).join(","));
  if (f.clubs.length) s.set("club", f.clubs.join(","));
  if (f.freeFood) s.set("food", "1");
  if (f.free) s.set("free", "1");
  if (f.mode !== "any") s.set("mode", f.mode);
  if (f.following) s.set("following", "1");
  if (f.q) s.set("q", f.q);
  const str = s.toString();
  return str ? `?${str}` : "";
}

export const activeFilterCount = (f: Filters) =>
  (f.date !== "all" ? 1 : 0) + f.categories.length + f.clubs.length + +f.freeFood + +f.free + +(f.mode !== "any") + +f.following + +(f.q !== "");

function inDateRange(e: EventView, preset: DatePreset, now: Date) {
  if (preset === "all") return true;
  const at = new Date(e.kind === "deadline" ? (e.deadlineAt ?? e.sortAt) : (e.startAt ?? e.sortAt));
  const today = startOfPtDay(now);
  const dayMs = 86_400_000;
  if (preset === "today") return ptDayKey(at) === ptDayKey(now);
  if (preset === "week") return at.getTime() < today.getTime() + 7 * dayMs + 2 * 3600_000;
  // weekend: the coming Fri 5pm → Sun end (or the current one if we're in it)
  const wd = ptWeekday(now);
  const daysToFri = wd === 0 ? -2 : wd === 6 ? -1 : 5 - wd;
  const fri = new Date(today.getTime() + daysToFri * dayMs);
  const start = new Date(fri.getTime() + 17 * 3600_000);
  const end = new Date(fri.getTime() + 3 * dayMs);
  return at >= start && at < end;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function matchesText(e: EventView, q: string) {
  if (!q) return true;
  const hay = norm(
    [e.title, e.summary, e.clubName, e.clubHandle ?? "", e.location?.name ?? "", e.tags.join(" "), e.categories.join(" ")].join(" "),
  );
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function applyFilters(
  events: EventView[],
  f: Filters,
  ctx: { followedClubs?: string[]; followedCategories?: Category[]; now?: Date } = {},
) {
  const now = ctx.now ?? new Date();
  return events.filter((e) => {
    if (!inDateRange(e, f.date, now)) return false;
    if (f.categories.length && !e.categories.some((c) => f.categories.includes(c))) return false;
    if (f.clubs.length && !f.clubs.includes(e.clubId)) return false;
    if (f.freeFood && !e.freeFood) return false;
    if (f.free && e.cost?.isFree !== true) return false;
    if (f.mode === "online" && !e.location?.isOnline) return false;
    if (f.mode === "in-person" && e.location?.isOnline) return false;
    if (f.following) {
      const fc = ctx.followedClubs ?? [];
      const fcat = ctx.followedCategories ?? [];
      if (!fc.includes(e.clubId) && !e.categories.some((c) => fcat.includes(c))) return false;
    }
    return matchesText(e, f.q);
  });
}

export { CATEGORIES };
