// Usage: node --env-file=../../.env scripts/run-status.mjs <runId> [--wait]
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = getFirestore();
const [id, wait] = process.argv.slice(2);
const show = (r) => `${new Date().toLocaleTimeString()} status=${r.status} new=${r.postsNew} processed=${r.postsProcessed} events=${r.eventsCreated}+${r.eventsMerged} errors=${(r.errors || []).length}`;
for (let i = 0; i < 60; i++) {
  const r = (await db.collection("scrapeRuns").doc(id).get()).data();
  console.log(show(r));
  if (!wait || ["done", "failed"].includes(r.status)) {
    if (r.errors?.length) console.log("errors:\n" + r.errors.slice(0, 5).join("\n"));
    break;
  }
  await new Promise((s) => setTimeout(s, 30_000));
}
process.exit(0);
