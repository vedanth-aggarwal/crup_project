import "server-only";
import { adminDb } from "./firebase-admin";
import { eventFromDoc } from "./convert";
import { listUpcomingEvents, withClubInfo } from "./data";
import type { EventView } from "@/lib/types";

/**
 * Similar upcoming events: vector neighbours when embeddings exist (Phase 4),
 * otherwise shared categories/tags as a fallback.
 */
export async function similarEvents(e: EventView, limit = 4): Promise<EventView[]> {
  const upcoming = await listUpcomingEvents();
  const upcomingIds = new Set(upcoming.map((u) => u.id));
  try {
    const doc = await adminDb().collection("events").doc(e.id).get();
    const vec = doc.get("embedding");
    if (vec) {
      const snap = await adminDb()
        .collection("events")
        .where("status", "==", "published")
        .findNearest({ vectorField: "embedding", queryVector: vec, limit: 20, distanceMeasure: "COSINE" })
        .get();
      const hits = snap.docs.map(eventFromDoc).filter((x) => x.id !== e.id && upcomingIds.has(x.id));
      if (hits.length) return withClubInfo(hits.slice(0, limit));
    }
  } catch {
    // vector index not ready yet: fall through
  }
  const score = (x: EventView) =>
    x.categories.filter((c) => e.categories.includes(c)).length * 2 +
    x.tags.filter((t) => e.tags.includes(t)).length +
    (x.clubId === e.clubId ? 1 : 0);
  return withClubInfo(
    upcoming
      .filter((x) => x.id !== e.id && x.kind === "event")
      .map((x) => [x, score(x)] as const)
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([x]) => x),
  );
}
