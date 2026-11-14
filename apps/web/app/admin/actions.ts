"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { CATEGORIES, categorySchema, eventDetailsSchema } from "@clubo/shared";
import { adminDb } from "@/lib/server/firebase-admin";
import { requireAdmin } from "@/lib/server/session";
import { TAGS } from "@/lib/server/data";
import { scheduleScrapes } from "@/lib/server/scrape";
import { processPost, processPending } from "@/lib/server/pipeline";
import { embed, embeddingText } from "@/lib/server/embed";

type Result<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

async function admin<T>(fn: () => Promise<T | Result<T>>): Promise<Result<T>> {
  try {
    await requireAdmin();
    const r = await fn();
    if (r && typeof r === "object" && "ok" in r) return r as Result<T>;
    return { ok: true, data: r as T };
  } catch (e) {
    console.error(e);
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

const bust = (id?: string) => {
  revalidateTag(TAGS.events, "max");
  if (id) revalidateTag(TAGS.event(id), "max");
  revalidatePath("/admin", "layout");
};

// ---------------- Clubs ----------------

const handleSchema = z
  .string()
  .trim()
  .transform((h) => h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "").toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/, "Not a valid Instagram handle"));

const clubInput = z.object({
  igHandle: handleSchema,
  name: z.string().trim().max(120).optional(),
  category: z.array(categorySchema).max(4).default([]),
  scrapeIntervalHours: z.coerce.number().int().min(6).max(24 * 14).default(24),
  website: z.string().trim().url().nullable().optional().or(z.literal("").transform(() => null)),
  avatarUrl: z.string().trim().url().nullable().optional().or(z.literal("").transform(() => null)),
  description: z.string().trim().max(500).nullable().optional(),
});

export async function addClub(input: unknown) {
  return admin(async () => {
    const c = clubInput.parse(input);
    const db = adminDb();
    const exists = await db.collection("clubs").where("igHandle", "==", c.igHandle).limit(1).get();
    if (!exists.empty) return { ok: false as const, error: `@${c.igHandle} is already added` };
    const ref = db.collection("clubs").doc(c.igHandle.replace(/\./g, "-"));
    await ref.set({
      name: c.name || c.igHandle,
      igHandle: c.igHandle,
      category: c.category,
      description: c.description ?? null,
      avatarUrl: c.avatarUrl ?? null,
      website: c.website ?? null,
      active: true,
      optOut: false,
      scrapeIntervalHours: c.scrapeIntervalHours,
      scrapeStatus: null,
      lastScrapedAt: null,
      lastPostAt: null,
      stats: { postsScraped: 0, eventsFound: 0 },
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidateTag(TAGS.clubs, "max");
    revalidatePath("/admin/clubs");
    return { ok: true as const, data: ref.id, message: `Added @${c.igHandle}` };
  });
}

/** CSV lines: handle,name,category1|category2,intervalHours */
export async function importClubsCsv(csv: string) {
  return admin(async () => {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^handle\b/i.test(l));
    let added = 0;
    const skipped: string[] = [];
    for (const line of lines.slice(0, 500)) {
      const [handle, name, cats, interval] = line.split(",").map((s) => s?.trim());
      const category = (cats ?? "").split("|").map((s) => s.trim()).filter((s): s is (typeof CATEGORIES)[number] => (CATEGORIES as readonly string[]).includes(s));
      const r = await addClub({ igHandle: handle, name, category, scrapeIntervalHours: interval || 24 });
      if (r.ok) added++;
      else skipped.push(`${handle}: ${r.error}`);
    }
    return { ok: true as const, data: { added, skipped }, message: `Added ${added}, skipped ${skipped.length}` };
  });
}

export async function updateClub(id: string, input: unknown) {
  return admin(async () => {
    const c = clubInput.partial().extend({ active: z.boolean().optional(), optOut: z.boolean().optional() }).parse(input);
    await adminDb().collection("clubs").doc(id).update({ ...c, updatedAt: FieldValue.serverTimestamp() });
    if (c.optOut) {
      // Opt-out hides every event from that club.
      const evs = await adminDb().collection("events").where("clubId", "==", id).get();
      const b = adminDb().batch();
      evs.docs.forEach((d) => b.update(d.ref, { status: "hidden" }));
      await b.commit();
      bust();
    }
    revalidateTag(TAGS.clubs, "max");
    revalidatePath("/admin/clubs");
    return undefined;
  });
}

export async function deleteClub(id: string) {
  return admin(async () => {
    await adminDb().collection("clubs").doc(id).delete();
    revalidateTag(TAGS.clubs, "max");
    revalidatePath("/admin/clubs");
    return undefined;
  });
}

export async function scrapeNow(clubIds?: string[]) {
  return admin(async () => {
    const r = await scheduleScrapes({ clubIds, force: true, trigger: "admin" });
    revalidatePath("/admin", "layout");
    return { ok: true as const, data: r, message: r.runs.length ? `Started ${r.runs.length} run(s) for ${r.clubs} club(s). Results arrive in a few minutes.` : "No active clubs to scrape" };
  });
}

export async function processPendingNow() {
  return admin(async () => {
    const t = await processPending({ budgetMs: 50_000, limit: 8 });
    bust();
    return { ok: true as const, data: t, message: `Processed ${t.processed} post(s), ${t.eventsCreated} new event(s)${t.remaining ? `, ${t.remaining} left` : ""}` };
  });
}

// ---------------- Posts ----------------

export async function reextractPost(postId: string) {
  return admin(async () => {
    const ref = adminDb().collection("posts").doc(postId);
    await ref.update({ status: "pending", attempts: 0 });
    const r = await processPost(ref);
    bust();
    return { ok: true as const, data: r, message: `Re-extracted: ${r.created} new, ${r.merged} merged` };
  });
}

// ---------------- Events ----------------

const iso = z.string().datetime({ offset: true }).nullable();
const eventEdit = z.object({
  title: z.string().trim().min(1).max(140),
  summary: z.string().trim().max(300),
  description: z.string().trim().max(5000),
  kind: z.enum(["event", "deadline"]),
  startAt: iso,
  endAt: iso,
  allDay: z.boolean(),
  deadlineAt: iso,
  recurrence: z.string().trim().max(100).nullable(),
  location: z.object({
    name: z.string().trim().max(200).nullable(),
    address: z.string().trim().max(300).nullable(),
    isOnline: z.boolean(),
    campusBuilding: z.string().trim().max(100).nullable(),
  }),
  categories: z.array(categorySchema).max(4),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(12),
  cost: z.object({ isFree: z.boolean().nullable(), price: z.string().trim().max(60).nullable() }),
  freeFood: z.boolean(),
  links: z.object({
    rsvp: z.string().url().nullable(),
    tickets: z.string().url().nullable(),
    application: z.string().url().nullable(),
    info: z.array(z.string().url()).max(8),
  }),
  status: z.enum(["published", "needs_review", "hidden"]),
  details: eventDetailsSchema,
});

const ts = (v: string | null) => (v ? Timestamp.fromDate(new Date(v)) : null);

export async function saveEvent(id: string, input: unknown) {
  return admin(async () => {
    const e = eventEdit.parse(input);
    const when = e.kind === "deadline" ? e.deadlineAt : e.startAt;
    if (e.status === "published" && !when) return { ok: false as const, error: `Set ${e.kind === "deadline" ? "a deadline" : "a start time"} before publishing` };
    const ref = adminDb().collection("events").doc(id);
    const before = (await ref.get()).data();
    if (!before) return { ok: false as const, error: "Event not found" };
    const [vector] = await embed([embeddingText({ ...e, clubName: before.clubName })]);
    const timeChanged =
      before.status === "published" &&
      (before.startAt?.toMillis?.() !== ts(e.startAt)?.toMillis() || before.location?.name !== e.location.name);
    await ref.update({
      ...e,
      startAt: ts(e.startAt),
      endAt: ts(e.endAt),
      deadlineAt: ts(e.deadlineAt),
      sortAt: ts(when) ?? before.sortAt,
      embedding: FieldValue.vector(vector!),
      uncertainFields: [],
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(e.status === "published" && before.status !== "published" ? { publishedAt: FieldValue.serverTimestamp() } : {}),
      // Tell people who saved it (handled by the notify cron).
      ...(timeChanged ? { pendingUpdateNotice: true } : {}),
    });
    bust(id);
    return { ok: true as const, message: "Saved" };
  });
}

export async function setEventStatus(id: string, status: "published" | "hidden" | "needs_review") {
  return admin(async () => {
    const ref = adminDb().collection("events").doc(id);
    const snap = await ref.get();
    if (status === "published" && !snap.get("sortAt")) return { ok: false as const, error: "Event has no date" };
    await ref.update({
      status,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(status === "published" && snap.get("status") !== "published" ? { publishedAt: FieldValue.serverTimestamp() } : {}),
    });
    bust(id);
    return { ok: true as const, message: status === "published" ? "Approved" : status === "hidden" ? "Hidden" : "Moved to review" };
  });
}

/** Merge `fromId` into `intoId`: union sources/tags/links, then delete the duplicate. */
export async function mergeEvents(fromId: string, intoId: string) {
  return admin(async () => {
    if (fromId === intoId) return { ok: false as const, error: "Pick a different event" };
    const db = adminDb();
    const [from, into] = await Promise.all([db.collection("events").doc(fromId).get(), db.collection("events").doc(intoId).get()]);
    if (!from.exists || !into.exists) return { ok: false as const, error: "Event not found" };
    const f = from.data()!, t = into.data()!;
    await into.ref.update({
      sourcePostIds: FieldValue.arrayUnion(...(f.sourcePostIds ?? [])),
      tags: FieldValue.arrayUnion(...(f.tags ?? [])),
      ...(f.links?.info?.length ? { "links.info": FieldValue.arrayUnion(...f.links.info) } : {}),
      ...(!t.links?.rsvp && f.links?.rsvp ? { "links.rsvp": f.links.rsvp } : {}),
      ...(!t.links?.application && f.links?.application ? { "links.application": f.links.application } : {}),
      ...(!t.poster && f.poster ? { poster: f.poster, posterPath: f.posterPath } : {}),
      ...(!t.description && f.description ? { description: f.description } : {}),
      bookmarkCount: FieldValue.increment(f.bookmarkCount ?? 0),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Move bookmarks so nobody loses a saved event.
    const bms = await db.collectionGroup("bookmarks").where("eventId", "==", fromId).get();
    if (!bms.empty) {
      const batch = db.batch();
      for (const b of bms.docs) {
        batch.set(b.ref.parent.doc(intoId), { ...b.data(), eventId: intoId }, { merge: true });
        batch.delete(b.ref);
      }
      await batch.commit();
    }
    await from.ref.delete();
    bust(intoId);
    bust(fromId);
    return { ok: true as const, message: "Merged" };
  });
}

// ---------------- Email ----------------

export async function sendTestEmail() {
  return admin(async () => {
    const me = await requireAdmin();
    if (!me.email) return { ok: false as const, error: "Your account has no email" };
    const { createElement } = await import("react");
    const { sendEmail, emailConfigured } = await import("@/lib/server/email");
    const { DigestEmail } = await import("@/emails/digest-email");
    const { env } = await import("@/lib/server/env");
    if (!emailConfigured()) return { ok: false as const, error: "Set SMTP_USER and SMTP_PASS first" };
    const url = `${env.appUrl}/settings`;
    await sendEmail({
      to: me.email,
      subject: "Clubo test email",
      unsubscribeUrl: url,
      react: createElement(DigestEmail, {
        preview: "If you can read this, email works.",
        heading: "Email works",
        greeting: "This is a test from the Clubo admin dashboard.",
        sections: [],
        appUrl: env.appUrl,
        manageUrl: url,
        unsubscribeUrl: url,
        unsubscribeLabel: "Email settings",
      }),
    });
    return { ok: true as const, message: `Sent to ${me.email}` };
  });
}
