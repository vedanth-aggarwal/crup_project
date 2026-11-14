import { NextResponse, after } from "next/server";
import { isCronAuthorized } from "@/lib/server/cron";
import { processPending } from "@/lib/server/pipeline";
import { chainExtract, markRunFinished } from "@/lib/server/scrape";

export const maxDuration = 300;

/** Works through `pending` posts; re-invokes itself while there's a backlog. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const runDocId = new URL(req.url).searchParams.get("run") ?? undefined;
  const totals = await processPending({ budgetMs: 240_000, runDocId });
  if (totals.remaining > 0 && totals.processed > 0) after(() => chainExtract(runDocId));
  else if (runDocId) await markRunFinished(runDocId, { status: "done" }).catch(() => {});
  return NextResponse.json(totals);
}
