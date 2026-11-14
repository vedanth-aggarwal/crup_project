import { NextResponse, after } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";
import { getDatasetItems, getRun } from "@/lib/server/apify";
import { ingestItems, processPending } from "@/lib/server/pipeline";
import { chainExtract, markRunFinished } from "@/lib/server/scrape";
import { safeEqual } from "@/lib/server/cron";

export const maxDuration = 300;

/**
 * Apify calls this when a scrape run ends. We store new posts right away,
 * then extract in the background (after the response) and chain if needed.
 */
export async function POST(req: Request) {
  if (!safeEqual(req.headers.get("x-clubo-secret"), process.env.APIFY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const runDocId = new URL(req.url).searchParams.get("run");
  if (!runDocId) return NextResponse.json({ error: "missing run" }, { status: 400 });

  const runRef = adminDb().collection("scrapeRuns").doc(runDocId);
  const runDoc = await runRef.get();
  if (!runDoc.exists) return NextResponse.json({ error: "unknown run" }, { status: 404 });
  if (runDoc.get("status") === "ingested" || runDoc.get("status") === "done") return NextResponse.json({ ok: true, duplicate: true });

  // Never trust the webhook body for the dataset: look the run up ourselves.
  const apifyRun = await getRun(runDoc.get("apifyRunId"));
  if (apifyRun.status !== "SUCCEEDED") {
    await markRunFinished(runDocId, { status: "failed", errors: FieldValue.arrayUnion(`Apify run ${apifyRun.status}`) });
    return NextResponse.json({ ok: true, status: apifyRun.status });
  }

  const items = await getDatasetItems(apifyRun.defaultDatasetId);
  const r = await ingestItems(items, runDoc.get("handles") ?? []);
  await runRef.update({ status: "ingested", postsNew: r.postsNew, itemsTotal: r.itemsTotal, "costEstimate.apify": r.apifyCost });

  after(async () => {
    const t = await processPending({ budgetMs: 230_000, runDocId });
    if (t.remaining > 0 && t.processed > 0) await chainExtract(runDocId);
    else await markRunFinished(runDocId, { status: "done" }).catch(() => {});
  });
  return NextResponse.json({ ok: true, ...r });
}
