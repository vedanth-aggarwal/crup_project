"use server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { categorySchema, notificationPrefsSchema } from "@clubo/shared";
import { adminDb } from "@/lib/server/firebase-admin";
import { AuthError, getSessionUser } from "@/lib/server/session";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; needsAuth?: boolean };

async function run<T>(fn: (uid: string) => Promise<T>): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to do that.", needsAuth: true };
  try {
    return { ok: true, data: await fn(user.uid) };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message, needsAuth: e.status === 401 };
    console.error(e);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Toggle a bookmark. Returns the new state. */
export async function toggleBookmark(eventId: string, on: boolean) {
  return run(async (uid) => {
    const id = z.string().min(1).max(128).parse(eventId);
    const db = adminDb();
    const ev = db.collection("events").doc(id);
    const bm = db.collection("users").doc(uid).collection("bookmarks").doc(id);
    await db.runTransaction(async (tx) => {
      const [evSnap, bmSnap] = await Promise.all([tx.get(ev), tx.get(bm)]);
      if (!evSnap.exists) throw new Error("Event not found");
      if (on && !bmSnap.exists) {
        tx.set(bm, {
          eventId: id,
          uid,
          createdAt: FieldValue.serverTimestamp(),
          eventStartAt: evSnap.get("startAt") ?? null,
          eventDeadlineAt: evSnap.get("deadlineAt") ?? null,
          sortAt: evSnap.get("sortAt") ?? Timestamp.now(),
        });
        tx.update(ev, { bookmarkCount: FieldValue.increment(1) });
      } else if (!on && bmSnap.exists) {
        tx.delete(bm);
        tx.update(ev, { bookmarkCount: FieldValue.increment(-1) });
      }
    });
    return on;
  });
}

export async function toggleFollowClub(clubId: string, on: boolean) {
  return run(async (uid) => {
    const id = z.string().min(1).max(128).parse(clubId);
    await adminDb()
      .collection("users")
      .doc(uid)
      .update({ followedClubs: on ? FieldValue.arrayUnion(id) : FieldValue.arrayRemove(id) });
    return on;
  });
}

export async function toggleFollowCategory(category: string, on: boolean) {
  return run(async (uid) => {
    const c = categorySchema.parse(category);
    await adminDb()
      .collection("users")
      .doc(uid)
      .update({ followedCategories: on ? FieldValue.arrayUnion(c) : FieldValue.arrayRemove(c) });
    return on;
  });
}

export async function updateNotificationPrefs(prefs: unknown) {
  return run(async (uid) => {
    const p = notificationPrefsSchema.parse(prefs);
    await adminDb().collection("users").doc(uid).update({ notificationPrefs: p });
    return undefined;
  });
}
