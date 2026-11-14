import "server-only";
import { unstable_cache } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { hasAdminCredentials } from "./env";
import { clubFromDoc, eventFromDoc } from "./convert";
import type { ClubView, EventView, UserView } from "@/lib/types";
import { DEFAULT_NOTIFICATION_PREFS } from "@clubo/shared";

export const TAGS = { events: "events", clubs: "clubs", event: (id: string) => `event:${id}` };

/** Events that ended (or deadlines that passed) within this window still show as "earlier today". */
const GRACE_MS = 3 * 60 * 60 * 1000;

/**
 * Every published, upcoming event (and open deadline). At student scale this
 * is a few hundred docs, so filters run in memory on this cached list.
 */
export const listUpcomingEvents = unstable_cache(
  async (): Promise<EventView[]> => {
    if (!hasAdminCredentials()) return [];
    const snap = await adminDb()
      .collection("events")
      .where("status", "==", "published")
      .where("sortAt", ">=", Timestamp.fromMillis(Date.now() - GRACE_MS))
      .orderBy("sortAt", "asc")
      .limit(1000)
      .get();
    return snap.docs.map(eventFromDoc);
  },
  ["upcoming-events-v1"],
  { tags: [TAGS.events], revalidate: 300 },
);

/** How far back the feed's "Past month" section reaches. */
export const PAST_WINDOW_DAYS = 30;

/** Published events from the last month that are already over, newest first. */
export const listRecentPastEvents = unstable_cache(
  async (): Promise<EventView[]> => {
    if (!hasAdminCredentials()) return [];
    const now = Date.now();
    const snap = await adminDb()
      .collection("events")
      .where("status", "==", "published")
      .where("sortAt", ">=", Timestamp.fromMillis(now - PAST_WINDOW_DAYS * 86_400_000))
      .where("sortAt", "<", Timestamp.fromMillis(now - GRACE_MS))
      .orderBy("sortAt", "asc") // uses the existing (status, sortAt) index
      .limit(500)
      .get();
    return snap.docs.map(eventFromDoc).reverse();
  },
  ["past-events-v1"],
  { tags: [TAGS.events], revalidate: 300 },
);

export const getEvent = (id: string) =>
  unstable_cache(
    async (): Promise<EventView | null> => {
      if (!hasAdminCredentials()) return null;
      const doc = await adminDb().collection("events").doc(id).get();
      return doc.exists ? eventFromDoc(doc) : null;
    },
    ["event-v1", id],
    { tags: [TAGS.events, TAGS.event(id)], revalidate: 300 },
  )();

export const listClubs = unstable_cache(
  async (): Promise<ClubView[]> => {
    if (!hasAdminCredentials()) return [];
    const snap = await adminDb().collection("clubs").where("optOut", "==", false).get();
    return snap.docs.map(clubFromDoc).sort((a, b) => a.name.localeCompare(b.name));
  },
  ["clubs-v1"],
  { tags: [TAGS.clubs], revalidate: 600 },
);

export async function getClub(id: string): Promise<ClubView | null> {
  const clubs = await listClubs();
  return clubs.find((c) => c.id === id) ?? null;
}

export const listPastClubEvents = (clubId: string) =>
  unstable_cache(
    async (): Promise<EventView[]> => {
      if (!hasAdminCredentials()) return [];
      const snap = await adminDb()
        .collection("events")
        .where("clubId", "==", clubId)
        .where("status", "==", "published")
        .where("sortAt", "<", Timestamp.now())
        .orderBy("sortAt", "desc")
        .limit(24)
        .get();
      return snap.docs.map(eventFromDoc);
    },
    ["club-past-v1", clubId],
    { tags: [TAGS.events], revalidate: 3600 },
  )();

/** Per-user data is never cached across users. */
export async function getUserView(uid: string): Promise<UserView | null> {
  const db = adminDb();
  const [doc, bms] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("users").doc(uid).collection("bookmarks").select().get(),
  ]);
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    uid,
    email: d.email ?? null,
    name: d.name ?? null,
    followedClubs: d.followedClubs ?? [],
    followedCategories: d.followedCategories ?? [],
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...(d.notificationPrefs ?? {}) },
    bookmarkIds: bms.docs.map((b) => b.id),
  };
}

export async function getEventsByIds(ids: string[]): Promise<EventView[]> {
  if (!ids.length) return [];
  const db = adminDb();
  const refs = ids.map((id) => db.collection("events").doc(id));
  const docs = await db.getAll(...refs);
  return docs.filter((d) => d.exists && d.get("status") === "published").map(eventFromDoc);
}

/** Attach club handle/avatar for cards. */
export async function withClubInfo(events: EventView[]): Promise<EventView[]> {
  const clubs = await listClubs();
  const byId = new Map(clubs.map((c) => [c.id, c]));
  return events.map((e) => {
    const c = byId.get(e.clubId);
    return { ...e, clubHandle: c?.igHandle, clubAvatarUrl: c?.avatarUrl ?? null };
  });
}
