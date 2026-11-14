import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { startScrape } from "./apify";
import { env } from "./env";

const BATCH = 40;

/**
 * Start Apify runs for clubs that are due (now - lastScrapedAt >= interval),
 * or for specific clubs when an admin clicks "Scrape now".
 */
export async function scheduleScrapes(opts: { clubIds?: string[]; force?: boolean; trigger: "cron" | "admin" }) {
  const db = adminDb();
  let docs = opts.clubIds?.length
    ? (await db.getAll(...opts.clubIds.map((id) => db.collection("clubs").doc(id)))).filter((d) => d.exists)
    : (await db.collection("clubs").where("active", "==", true).get()).docs;
  docs = docs.filter((d) => !d.get("optOut"));
  const now = Date.now();
  const due = opts.force
    ? docs
    : docs.filter((d) => {
        const last = d.get("lastScrapedAt")?.toMillis?.() ?? 0;
        // Small slack so a daily cron doesn't skip clubs scraped 23h59m ago.
        return now - last >= (d.get("scrapeIntervalHours") ?? 24) * 3600_000 - 30 * 60_000;
      });
  if (!due.length) return { runs: [] as string[], clubs: 0 };

  const runs: string[] = [];
  for (let i = 0; i < due.length; i += BATCH) {
    const chunk = due.slice(i, i + BATCH);
    const handles = chunk.map((d) => d.get("igHandle") as string);
    // Fetch everything since the oldest "last post" in the batch (minus a day for edits), max 21 days back.
    const oldest = Math.min(...chunk.map((d) => d.get("lastPostAt")?.toMillis?.() ?? now - 21 * 86_400_000));
    const newerThan = new Date(Math.max(oldest - 86_400_000, now - 21 * 86_400_000)).toISOString().slice(0, 10);
    const runRef = db.collection("scrapeRuns").doc();
    await runRef.set({
      trigger: opts.trigger,
      status: "starting",
      handles,
      clubsProcessed: handles.length,
      startedAt: FieldValue.serverTimestamp(),
      finishedAt: null,
      postsNew: 0,
      postsProcessed: 0,
      eventsCreated: 0,
      eventsMerged: 0,
      costEstimate: { apify: 0, llm: 0 },
      errors: [],
    });
    try {
      const run = await startScrape({ handles, newerThan, resultsLimit: 10, runDocId: runRef.id });
      await runRef.update({ status: "running", apifyRunId: run.id, datasetId: run.defaultDatasetId });
      runs.push(runRef.id);
    } catch (e) {
      await runRef.update({ status: "failed", finishedAt: FieldValue.serverTimestamp(), errors: [String(e).slice(0, 500)] });
      throw e;
    }
  }
  return { runs, clubs: due.length };
}

/** Kick the extract worker in a fresh invocation (keeps each request under the time limit). */
export async function chainExtract(runDocId?: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const url = `${env.appUrl}/api/cron/extract${runDocId ? `?run=${encodeURIComponent(runDocId)}` : ""}`;
  // Fire and forget; the next invocation does the work.
  await fetch(url, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(2500) }).catch(() => {});
}

export const markRunFinished = (runDocId: string, patch: Record<string, unknown>) =>
  adminDb().collection("scrapeRuns").doc(runDocId).update({ ...patch, finishedAt: Timestamp.now() });
