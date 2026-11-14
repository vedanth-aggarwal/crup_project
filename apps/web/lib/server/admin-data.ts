import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { clubFromDoc, eventFromDoc, toIso } from "./convert";

export async function adminClubs() {
  const snap = await adminDb().collection("clubs").get();
  return snap.docs.map(clubFromDoc).sort((a, b) => a.name.localeCompare(b.name));
}

export async function reviewQueue() {
  const snap = await adminDb().collection("events").where("status", "==", "needs_review").orderBy("updatedAt", "desc").limit(100).get();
  return snap.docs.map(eventFromDoc);
}

export async function recentEvents(status?: string) {
  let q = adminDb().collection("events").orderBy("updatedAt", "desc").limit(300);
  if (status) q = adminDb().collection("events").where("status", "==", status).orderBy("updatedAt", "desc").limit(300);
  return (await q.get()).docs.map(eventFromDoc);
}

export async function getAdminEvent(id: string) {
  const d = await adminDb().collection("events").doc(id).get();
  return d.exists ? eventFromDoc(d) : null;
}

export type PostView = {
  id: string;
  clubId: string;
  handle: string;
  url: string;
  caption: string;
  postedAt: string | null;
  type: string;
  imagePaths: string[];
  status: string;
  confidence: number | null;
  error: string | null;
  model: string | null;
  raw: unknown;
  resolvedLinks: { url: string; title: string | null }[];
};

const postFromDoc = (d: FirebaseFirestore.DocumentSnapshot): PostView => {
  const p = d.data() ?? {};
  return {
    id: d.id,
    clubId: p.clubId,
    handle: p.handle ?? "",
    url: p.url,
    caption: p.caption ?? "",
    postedAt: toIso(p.postedAt),
    type: p.type,
    imagePaths: p.imagePaths ?? [],
    status: p.status,
    confidence: p.extraction?.confidence ?? null,
    error: p.extraction?.error ?? null,
    model: p.extraction?.model ?? null,
    raw: p.extraction?.raw ?? null,
    resolvedLinks: (p.resolvedLinks ?? []).map((l: { url: string; title: string | null }) => ({ url: l.url, title: l.title })),
  };
};

export async function recentPosts(status?: string) {
  const base = adminDb().collection("posts");
  const q = status ? base.where("status", "==", status).orderBy("postedAt", "desc") : base.orderBy("postedAt", "desc");
  return (await q.limit(150).get()).docs.map(postFromDoc);
}

export async function getPosts(ids: string[]) {
  if (!ids.length) return [];
  const db = adminDb();
  return (await db.getAll(...ids.map((id) => db.collection("posts").doc(id)))).filter((d) => d.exists).map(postFromDoc);
}

export type RunView = {
  id: string;
  trigger: string;
  status: string;
  handles: string[];
  startedAt: string | null;
  finishedAt: string | null;
  postsNew: number;
  postsProcessed: number;
  eventsCreated: number;
  eventsMerged: number;
  cost: number;
  errors: string[];
};

export async function recentRuns(limit = 50): Promise<RunView[]> {
  const snap = await adminDb().collection("scrapeRuns").orderBy("startedAt", "desc").limit(limit).get();
  return snap.docs.map((d) => {
    const r = d.data();
    return {
      id: d.id,
      trigger: r.trigger,
      status: r.status,
      handles: r.handles ?? [],
      startedAt: toIso(r.startedAt),
      finishedAt: toIso(r.finishedAt),
      postsNew: r.postsNew ?? 0,
      postsProcessed: r.postsProcessed ?? 0,
      eventsCreated: r.eventsCreated ?? 0,
      eventsMerged: r.eventsMerged ?? 0,
      cost: (r.costEstimate?.apify ?? 0) + (r.costEstimate?.llm ?? 0),
      errors: r.errors ?? [],
    };
  });
}

export async function dashboardStats() {
  const db = adminDb();
  const weekAgo = Timestamp.fromMillis(Date.now() - 7 * 86_400_000);
  // One slow or still-indexing query shouldn't take down the whole dashboard.
  const count = async (q: FirebaseFirestore.Query): Promise<number | null> => {
    try {
      return (await q.count().get()).data().count;
    } catch (e) {
      console.error("dashboard count failed", e);
      return null;
    }
  };
  const [clubs, activeClubs, pending, review, published, users, failed, runs] = await Promise.all([
    count(db.collection("clubs")),
    count(db.collection("clubs").where("active", "==", true)),
    count(db.collection("posts").where("status", "==", "pending")),
    count(db.collection("events").where("status", "==", "needs_review")),
    count(db.collection("events").where("status", "==", "published").where("sortAt", ">=", Timestamp.now())),
    count(db.collection("users")),
    count(db.collection("posts").where("status", "==", "failed")),
    db.collection("scrapeRuns").where("startedAt", ">=", Timestamp.fromMillis(Date.now() - 14 * 86_400_000)).get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
  ]);
  const byDay = new Map<string, { posts: number; events: number; cost: number }>();
  for (let i = 13; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(key, { posts: 0, events: 0, cost: 0 });
  }
  let cost30 = 0;
  for (const d of runs.docs) {
    const r = d.data();
    const key = r.startedAt?.toDate?.().toISOString().slice(0, 10);
    const c = (r.costEstimate?.apify ?? 0) + (r.costEstimate?.llm ?? 0);
    cost30 += c;
    const slot = key && byDay.get(key);
    if (slot) {
      slot.posts += r.postsNew ?? 0;
      slot.events += r.eventsCreated ?? 0;
      slot.cost += c;
    }
  }
  const processed = await count(db.collection("posts").where("updatedAt", ">=", weekAgo));
  const failedWeek = await count(db.collection("posts").where("status", "==", "failed").where("updatedAt", ">=", weekAgo));
  return {
    clubs,
    activeClubs,
    pending,
    review,
    published,
    users,
    failed,
    cost14: cost30,
    successRate: processed && failedWeek !== null ? 1 - failedWeek / processed : null,
    days: [...byDay.entries()].map(([day, v]) => ({ day, ...v })),
  };
}
