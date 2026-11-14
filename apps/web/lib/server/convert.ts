import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { ClubView, EventView } from "@/lib/types";
import { EMPTY_EVENT_DETAILS } from "@clubo/shared";

export const toIso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
};

export const toTs = (v: Date | string | null | undefined): Timestamp | null =>
  v ? Timestamp.fromDate(typeof v === "string" ? new Date(v) : v) : null;

export function eventFromDoc(doc: DocumentSnapshot): EventView {
  const d = doc.data() ?? {};
  const rest: Record<string, unknown> = { ...d };
  delete rest.embedding;
  // Any other Firestore Timestamp (publishedAt, reviewedAt…) becomes an ISO string,
  // so the object stays plain and can be passed to client components.
  for (const [k, v] of Object.entries(rest)) if (v instanceof Timestamp) rest[k] = v.toDate().toISOString();
  return {
    ...(rest as Omit<EventView, "id">),
    id: doc.id,
    startAt: toIso(d.startAt),
    endAt: toIso(d.endAt),
    deadlineAt: toIso(d.deadlineAt),
    sortAt: toIso(d.sortAt) ?? new Date(0).toISOString(),
    createdAt: toIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(d.updatedAt) ?? new Date(0).toISOString(),
    tags: d.tags ?? [],
    categories: d.categories ?? [],
    imagePaths: d.imagePaths ?? [],
    sourcePostIds: d.sourcePostIds ?? [],
    uncertainFields: d.uncertainFields ?? [],
    details: { ...EMPTY_EVENT_DETAILS, ...(d.details ?? {}) },
  };
}

export function clubFromDoc(doc: DocumentSnapshot): ClubView {
  const d = doc.data() ?? {};
  return {
    ...(d as Omit<ClubView, "id">),
    id: doc.id,
    category: d.category ?? [],
    stats: d.stats ?? { postsScraped: 0, eventsFound: 0 },
    optOut: d.optOut ?? false,
    scrapeStatus: d.scrapeStatus ?? null,
    lastScrapedAt: toIso(d.lastScrapedAt),
    lastPostAt: toIso(d.lastPostAt),
  };
}
