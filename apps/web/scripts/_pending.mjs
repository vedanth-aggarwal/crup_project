import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = getFirestore();
for (let i = 0; i < 40; i++) {
  const by = {};
  for (const p of (await db.collection("posts").get()).docs) by[p.get("status")] = (by[p.get("status")] || 0) + 1;
  const ev = (await db.collection("events").count().get()).data().count;
  console.log(new Date().toLocaleTimeString(), JSON.stringify(by), "events", ev);
  if (!by.pending && !by.processing) break;
  await new Promise((r) => setTimeout(r, 30000));
}
process.exit(0);
