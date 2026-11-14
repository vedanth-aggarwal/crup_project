import "server-only";
import { createElement } from "react";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { DEFAULT_NOTIFICATION_PREFS } from "@clubo/shared";
import { adminDb } from "./firebase-admin";
import { eventFromDoc } from "./convert";
import { env } from "./env";
import { sendEmail } from "./email";
import { unsubscribeUrl } from "./unsubscribe";
import { DigestEmail, type EmailEvent, type EmailSection } from "@/emails/digest-email";
import { countdown, formatWhen, longDateTime, ptWeekday } from "@/lib/dates";
import type { EventView } from "@/lib/types";

const HOUR = 3600_000;
const RUN_WINDOW = 24 * HOUR; // the cron runs daily; send anything due before the next run

const toEmail = (e: EventView, badge?: string): EmailEvent => ({
  id: e.id,
  title: e.title,
  clubName: e.clubName,
  when: e.kind === "deadline" && e.deadlineAt ? `Due ${longDateTime(e.deadlineAt)}` : formatWhen(e.startAt, e.endAt, e.allDay),
  where: e.location?.isOnline ? "Online" : e.location?.name ?? null,
  posterUrl: e.poster?.sizes.sm ?? null,
  url: `${env.appUrl}/events/${e.id}`,
  badge,
});

type Pending = { key: string; type: string; eventId: string | null };

/**
 * Daily notification job. At most one email per user per run (plus "Update:"
 * notices). Every send is logged in `notifications` so nothing goes out twice.
 */
export async function runNotifications(now = new Date()) {
  const db = adminDb();
  const t = now.getTime();
  const [upcomingSnap, newSnap, usersSnap] = await Promise.all([
    db.collection("events").where("status", "==", "published").where("sortAt", ">=", Timestamp.fromMillis(t - HOUR)).orderBy("sortAt").limit(1000).get(),
    db.collection("events").where("status", "==", "published").where("publishedAt", ">=", Timestamp.fromMillis(t - 26 * HOUR)).get(),
    db.collection("users").get(),
  ]);
  const upcoming = upcomingSnap.docs.map(eventFromDoc);
  const byId = new Map(upcoming.map((e) => [e.id, e]));
  const fresh = newSnap.docs.map(eventFromDoc).filter((e) => byId.has(e.id));
  const sunday = ptWeekday(now) === 0;
  const weekKey = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  const stats = { users: 0, emails: 0, updates: 0, errors: [] as string[] };

  for (const u of usersSnap.docs) {
    const user = u.data();
    if (!user.email) continue;
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...(user.notificationPrefs ?? {}) };
    if (user.unsubscribedAll) continue;
    stats.users++;
    const bookmarkIds = new Set((await u.ref.collection("bookmarks").select().get()).docs.map((d) => d.id));
    const followedClubs = new Set<string>(user.followedClubs ?? []);
    const followedCats = new Set<string>(user.followedCategories ?? []);
    const follows = (e: EventView) => followedClubs.has(e.clubId) || e.categories.some((c) => followedCats.has(c));

    const candidates: { section: string; e: EventView; badge?: string; p: Pending }[] = [];

    if (prefs.reminders) {
      for (const id of bookmarkIds) {
        const e = byId.get(id);
        if (!e || e.kind !== "event" || !e.startAt) continue;
        const start = Date.parse(e.startAt);
        if (start > t && start - prefs.reminderLeadHours * HOUR <= t + RUN_WINDOW) {
          candidates.push({ section: "Coming up from your saved list", e, p: { key: `${u.id}_${id}_reminder`, type: "reminder", eventId: id } });
        }
      }
    }
    if (prefs.deadlines) {
      for (const e of upcoming) {
        if (e.kind !== "deadline" || !e.deadlineAt) continue;
        if (!bookmarkIds.has(e.id) && !followedClubs.has(e.clubId)) continue;
        const left = Date.parse(e.deadlineAt) - t;
        const stage = left <= 0 ? null : left <= 30 * HOUR ? "1d" : left <= 84 * HOUR ? "3d" : null;
        if (!stage) continue;
        candidates.push({ section: "Deadlines closing soon", e, badge: countdown(e.deadlineAt, now).label, p: { key: `${u.id}_${e.id}_deadline_${stage}`, type: `deadline_${stage}`, eventId: e.id } });
      }
    }
    if (prefs.newFromFollowed) {
      for (const e of fresh) {
        if (!follows(e) || bookmarkIds.has(e.id)) continue;
        candidates.push({ section: "New from clubs you follow", e, p: { key: `${u.id}_${e.id}_new`, type: "new", eventId: e.id } });
      }
    }
    const digest: EventView[] = [];
    if (sunday && prefs.weeklyDigest) {
      const week = upcoming.filter((e) => Date.parse(e.sortAt) < t + 7 * 24 * HOUR);
      const mine = week.filter(follows);
      const popular = [...week].sort((a, b) => (b.bookmarkCount ?? 0) - (a.bookmarkCount ?? 0)).filter((e) => !mine.includes(e));
      digest.push(...mine.slice(0, 5), ...popular.slice(0, Math.max(3, 6 - mine.length)));
    }

    // Drop anything already sent.
    const keys = [...candidates.map((c) => c.p.key), ...(digest.length ? [`${u.id}_${weekKey}_digest`] : [])];
    if (!keys.length) continue;
    const sent = new Set(
      (await db.getAll(...keys.map((k) => db.collection("notifications").doc(k)))).filter((d) => d.exists).map((d) => d.id),
    );
    const todo = candidates.filter((c) => !sent.has(c.p.key));
    const sendDigest = digest.length > 0 && !sent.has(`${u.id}_${weekKey}_digest`);
    if (!todo.length && !sendDigest) continue;

    const sections: EmailSection[] = [];
    for (const name of ["Coming up from your saved list", "Deadlines closing soon", "New from clubs you follow"]) {
      const evs = todo.filter((c) => c.section === name);
      if (evs.length) sections.push({ title: name, events: evs.slice(0, 8).map((c) => toEmail(c.e, c.badge)) });
    }
    if (sendDigest) sections.push({ title: "Your week ahead", intro: "From clubs you follow, plus what everyone's saving.", events: digest.map((e) => toEmail(e)) });

    const first = todo[0]?.e ?? digest[0]!;
    const subject = sendDigest
      ? "Your week ahead at Berkeley"
      : todo.length === 1
        ? todo[0]!.section.startsWith("Deadline")
          ? `Closing soon: ${first.title}`
          : todo[0]!.section.startsWith("New")
            ? `New from ${first.clubName}: ${first.title}`
            : `Reminder: ${first.title} ${formatWhen(first.startAt, first.endAt, first.allDay).split(" · ")[0]}`
        : `${todo.length} things on your Clubo radar`;

    const unsub = unsubscribeUrl(u.id, "all");
    try {
      await sendEmail({
        to: user.email,
        subject,
        unsubscribeUrl: unsub,
        react: createElement(DigestEmail, {
          preview: sections.map((s) => s.events[0]?.title).filter(Boolean).join(" · "),
          heading: sendDigest ? "Your week ahead" : "Heads up",
          greeting: user.name ? `Hi ${String(user.name).split(" ")[0]},` : undefined,
          sections,
          appUrl: env.appUrl,
          manageUrl: `${env.appUrl}/settings`,
          unsubscribeUrl: unsub,
          unsubscribeLabel: "Unsubscribe from all Clubo emails",
        }),
      });
      const batch = db.batch();
      const log = [...todo.map((c) => c.p), ...(sendDigest ? [{ key: `${u.id}_${weekKey}_digest`, type: "digest", eventId: null }] : [])];
      for (const p of log) batch.set(db.collection("notifications").doc(p.key), { uid: u.id, eventId: p.eventId, type: p.type, sentAt: FieldValue.serverTimestamp() });
      await batch.commit();
      stats.emails++;
    } catch (e) {
      stats.errors.push(`${u.id}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
    }
  }

  stats.updates = await sendUpdateNotices();
  return stats;
}

/** Time or place changed after people saved it → "Update:" email to them. */
async function sendUpdateNotices() {
  const db = adminDb();
  const changed = await db.collection("events").where("pendingUpdateNotice", "==", true).limit(20).get();
  let sent = 0;
  for (const doc of changed.docs) {
    const e = eventFromDoc(doc);
    const bms = await db.collectionGroup("bookmarks").where("eventId", "==", e.id).get();
    const uids = [...new Set(bms.docs.map((b) => b.ref.parent.parent!.id))];
    const users = uids.length ? await db.getAll(...uids.map((id) => db.collection("users").doc(id))) : [];
    for (const u of users) {
      const d = u.data();
      if (!d?.email || d.unsubscribedAll || d.notificationPrefs?.reminders === false) continue;
      const unsub = unsubscribeUrl(u.id, "reminders");
      try {
        await sendEmail({
          to: d.email,
          subject: `Update: ${e.title} has changed`,
          unsubscribeUrl: unsub,
          react: createElement(DigestEmail, {
            preview: `New details for ${e.title}`,
            heading: "An event you saved changed",
            greeting: "The club updated the time or place. Here are the latest details:",
            sections: [{ title: "Updated", events: [toEmail(e)] }],
            appUrl: env.appUrl,
            manageUrl: `${env.appUrl}/settings`,
            unsubscribeUrl: unsub,
            unsubscribeLabel: "Stop event reminders",
          }),
        });
        sent++;
      } catch {
        /* one bad address shouldn't block the rest */
      }
    }
    await doc.ref.update({ pendingUpdateNotice: FieldValue.delete() });
  }
  return sent;
}
