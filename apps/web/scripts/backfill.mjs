// Usage: node --env-file=../../.env scripts/backfill.mjs <days> <handle> [handle...]
// One-off Apify run with a longer lookback (e.g. for newly added clubs). Results go
// through the production webhook exactly like a cron run; existing posts are skipped.
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

const [days, ...handles] = process.argv.slice(2);
if (!Number(days) || !handles.length) {
  console.error("usage: backfill.mjs <days> <handle> [handle...]");
  process.exit(1);
}
const appUrl = process.env.BACKFILL_APP_URL || "https://clubo-six.vercel.app";
const newerThan = new Date(Date.now() - Number(days) * 86_400_000).toISOString().slice(0, 10);

const runRef = db.collection("scrapeRuns").doc();
await runRef.set({
  trigger: "admin",
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

const webhook = [
  {
    eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
    requestUrl: `${appUrl}/api/webhooks/apify?run=${runRef.id}`,
    headersTemplate: JSON.stringify({ "x-clubo-secret": process.env.APIFY_WEBHOOK_SECRET }),
  },
];
const qs = new URLSearchParams({ webhooks: Buffer.from(JSON.stringify(webhook)).toString("base64") });
const res = await fetch(`https://api.apify.com/v2/acts/${process.env.APIFY_ACTOR_ID.replace("/", "~")}/runs?${qs}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.APIFY_API_TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify({
    username: handles,
    resultsLimit: 15,
    onlyPostsNewerThan: newerThan,
    skipPinnedPosts: true,
    dataDetailLevel: "basicData",
  }),
});
if (!res.ok) {
  await runRef.update({ status: "failed", errors: [await res.text()] });
  throw new Error(`Apify ${res.status}`);
}
const { data } = await res.json();
await runRef.update({ status: "running", apifyRunId: data.id, datasetId: data.defaultDatasetId });
console.log(`run ${runRef.id} (apify ${data.id}) — ${handles.length} clubs since ${newerThan}`);
process.exit(0);
