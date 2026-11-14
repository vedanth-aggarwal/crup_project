import "server-only";
import { z } from "zod";
import { CATEGORIES } from "@clubo/shared";
import { adminDb } from "./firebase-admin";
import { eventFromDoc } from "./convert";
import { getEvent, listClubs, listUpcomingEvents, withClubInfo } from "./data";
import { embed } from "./embed";
import { matchesText } from "@/lib/filters";
import { formatWhen } from "@/lib/dates";
import type { EventView } from "@/lib/types";

/** Compact event shape sent back to the model (keeps tokens down). */
const brief = (e: EventView) => ({
  id: e.id,
  title: e.title,
  club: e.clubName,
  kind: e.kind,
  when: e.kind === "deadline" && e.deadlineAt ? `Due ${formatWhen(e.deadlineAt, null, false)}` : formatWhen(e.startAt, e.endAt, e.allDay),
  location: e.location?.isOnline ? "Online" : e.location?.name ?? null,
  summary: e.summary,
  categories: e.categories,
  tags: e.tags,
  free: e.cost?.isFree ?? null,
  freeFood: e.freeFood,
  url: `/events/${e.id}`,
});

const inRange = (e: EventView, from?: string | null, to?: string | null) => {
  const t = new Date(e.sortAt).getTime();
  if (from && t < Date.parse(from)) return false;
  if (to && t > Date.parse(to)) return false;
  return true;
};

const searchArgs = z.object({
  dateFrom: z.string().nullable().describe("ISO 8601 lower bound (Pacific offset). Null = from now."),
  dateTo: z.string().nullable().describe("ISO 8601 upper bound. Null = no bound."),
  categories: z.array(z.enum(CATEGORIES)).nullable(),
  clubIds: z.array(z.string()).nullable(),
  freeFood: z.boolean().nullable(),
  isFree: z.boolean().nullable(),
  kind: z.enum(["event", "deadline"]).nullable(),
  text: z.string().nullable().describe("Keywords that must appear (title, club, tags, location)."),
  limit: z.number().int().nullable(),
});

const semanticArgs = z.object({
  query: z.string().describe("What the student is looking for, in natural language."),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  limit: z.number().int().nullable(),
});

const getEventArgs = z.object({ id: z.string() });
const listClubsArgs = z.object({ category: z.enum(CATEGORIES).nullable(), query: z.string().nullable() });
const bookmarkArgs = z.object({ id: z.string() });

/** Zod → JSON Schema for strict function calling: every object closed, every key required. */
function strictJson(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (o.type === "object" && o.properties) {
      o.additionalProperties = false;
      o.required = Object.keys(o.properties as object);
    }
    Object.values(o).forEach((v) => (Array.isArray(v) ? v.forEach(walk) : walk(v)));
  };
  walk(json);
  return json;
}

/** JSON-schema tool definitions for the Responses API (strict mode). */
export const TOOL_DEFS = [
  {
    type: "function" as const,
    name: "search_events",
    description: "Exact structured search over upcoming published events. Use for date/category/club/free-food questions.",
    parameters: strictJson(searchArgs),
    strict: true,
  },
  {
    type: "function" as const,
    name: "semantic_search",
    description: "Vector search by meaning, for fuzzy asks like 'something chill to meet people' or 'startup events'. Optional date bounds.",
    parameters: strictJson(semanticArgs),
    strict: true,
  },
  {
    type: "function" as const,
    name: "get_event",
    description: "Full details for one event id (links, description, address).",
    parameters: strictJson(getEventArgs),
    strict: true,
  },
  {
    type: "function" as const,
    name: "list_clubs",
    description: "List clubs, optionally by category or name query.",
    parameters: strictJson(listClubsArgs),
    strict: true,
  },
  {
    type: "function" as const,
    name: "bookmark_event",
    description: "Save an event to the student's Saved list. Only when they ask to save/bookmark.",
    parameters: strictJson(bookmarkArgs),
    strict: true,
  },
];

export type ToolContext = { uid: string | null; onEvents: (events: EventView[]) => void; bookmark: (id: string) => Promise<boolean> };

export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<unknown> {
  const args = JSON.parse(rawArgs || "{}");
  switch (name) {
    case "search_events": {
      const a = searchArgs.parse(args);
      const all = await listUpcomingEvents();
      const hits = all
        .filter((e) => inRange(e, a.dateFrom, a.dateTo))
        .filter((e) => !a.kind || e.kind === a.kind)
        .filter((e) => !a.categories?.length || e.categories.some((c) => a.categories!.includes(c)))
        .filter((e) => !a.clubIds?.length || a.clubIds.includes(e.clubId))
        .filter((e) => a.freeFood !== true || e.freeFood)
        .filter((e) => a.isFree !== true || e.cost?.isFree === true)
        .filter((e) => !a.text || matchesText(e, a.text))
        .slice(0, Math.min(a.limit ?? 8, 15));
      const withClubs = await withClubInfo(hits);
      ctx.onEvents(withClubs);
      return { count: hits.length, events: withClubs.map(brief) };
    }
    case "semantic_search": {
      const a = semanticArgs.parse(args);
      const [vec] = await embed([a.query]);
      const upcoming = new Map((await listUpcomingEvents()).map((e) => [e.id, e]));
      let hits: EventView[] = [];
      try {
        const snap = await adminDb()
          .collection("events")
          .where("status", "==", "published")
          .findNearest({ vectorField: "embedding", queryVector: vec!, limit: 40, distanceMeasure: "COSINE", distanceThreshold: 0.75 })
          .get();
        hits = snap.docs.map(eventFromDoc).filter((e) => upcoming.has(e.id) && inRange(e, a.dateFrom, a.dateTo));
      } catch {
        // Vector index still building: fall back to keywords.
        hits = [...upcoming.values()].filter((e) => inRange(e, a.dateFrom, a.dateTo) && a.query.split(/\s+/).some((w) => w.length > 3 && matchesText(e, w)));
      }
      const withClubs = await withClubInfo(hits.slice(0, Math.min(a.limit ?? 6, 12)));
      ctx.onEvents(withClubs);
      return { count: withClubs.length, events: withClubs.map(brief) };
    }
    case "get_event": {
      const { id } = getEventArgs.parse(args);
      const e = await getEvent(id);
      if (!e || e.status !== "published") return { error: "Not found" };
      const [full] = await withClubInfo([e]);
      ctx.onEvents([full!]);
      return { ...brief(full!), description: e.description, address: e.location?.address, links: e.links, recurrence: e.recurrence, price: e.cost?.price };
    }
    case "list_clubs": {
      const a = listClubsArgs.parse(args);
      const q = a.query?.toLowerCase();
      const clubs = (await listClubs())
        .filter((c) => c.active && (!a.category || c.category.includes(a.category)) && (!q || c.name.toLowerCase().includes(q) || c.igHandle.includes(q) || c.description?.toLowerCase().includes(q)))
        .slice(0, 20);
      return { clubs: clubs.map((c) => ({ id: c.id, name: c.name, handle: `@${c.igHandle}`, categories: c.category, url: `/clubs/${c.id}` })) };
    }
    case "bookmark_event": {
      const { id } = bookmarkArgs.parse(args);
      if (!ctx.uid) return { error: "The student is not signed in." };
      const ok = await ctx.bookmark(id);
      return ok ? { saved: true } : { error: "Could not save that event." };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}
