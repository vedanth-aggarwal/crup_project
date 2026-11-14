import "server-only";
import { revalidateTag } from "next/cache";
import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { AUTO_PUBLISH_CONFIDENCE, type ExtractionResult } from "@clubo/shared";
import { adminDb } from "./firebase-admin";
import { APIFY_COST_PER_RESULT, type ApifyPost } from "./apify";
import { imageSources, processImage, type ProcessedImage } from "./images";
import { extractLinks, resolveLinks } from "./links";
import { extractEvents } from "./extract";
import { embed, embeddingText } from "./embed";
import { TAGS } from "./data";

type ExtractedItem = ExtractionResult["items"][number];

const handleOf = (p: ApifyPost) =>
  (p.ownerUsername ?? p.inputUrl?.match(/instagram\.com\/([^/?#]+)/)?.[1] ?? p.inputUrl ?? "").toLowerCase().replace(/^@/, "");

/**
 * Step 1 (fast, runs in the webhook): store new posts as `pending` and update
 * club scrape stats. Idempotent: posts are keyed by IG shortcode.
 */
export async function ingestItems(items: ApifyPost[], requestedHandles: string[]) {
  const db = adminDb();
  const clubsSnap = await db.collection("clubs").where("igHandle", "in", requestedHandles.slice(0, 30)).get();
  const extra = requestedHandles.length > 30
    ? await Promise.all(
        Array.from({ length: Math.ceil((requestedHandles.length - 30) / 30) }, (_, i) =>
          db.collection("clubs").where("igHandle", "in", requestedHandles.slice(30 + i * 30, 60 + i * 30)).get(),
        ),
      )
    : [];
  const clubs = new Map<string, { id: string; name: string; lastPostAt: Date | null }>();
  for (const d of [clubsSnap, ...extra].flatMap((s) => s.docs)) {
    clubs.set(d.get("igHandle"), { id: d.id, name: d.get("name"), lastPostAt: d.get("lastPostAt")?.toDate() ?? null });
  }

  const posts = items.filter((p) => p.shortCode && p.timestamp);
  const seen = new Map<string, { count: number; newest: Date | null }>();
  let postsNew = 0;

  for (const p of posts) {
    const handle = handleOf(p);
    const club = clubs.get(handle);
    if (!club) continue;
    const postedAt = new Date(p.timestamp!);
    const s = seen.get(handle) ?? { count: 0, newest: null };
    s.count++;
    if (!s.newest || postedAt > s.newest) s.newest = postedAt;
    seen.set(handle, s);

    const ref = db.collection("posts").doc(p.shortCode!);
    const created = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const caption = p.caption ?? "";
      if (snap.exists) {
        // Edited caption after scraping → re-extract.
        if (snap.get("caption") !== caption && snap.get("status") !== "pending") {
          tx.update(ref, { caption, status: "pending", updatedAt: FieldValue.serverTimestamp() });
        }
        return false;
      }
      tx.set(ref, {
        clubId: club.id,
        handle,
        shortcode: p.shortCode,
        url: p.url ?? `https://www.instagram.com/p/${p.shortCode}/`,
        caption,
        postedAt: Timestamp.fromDate(postedAt),
        type: p.type === "Sidecar" ? "carousel" : p.type === "Video" ? "video" : "image",
        sourceImageUrls: imageSources(p),
        imagePaths: [],
        rawLinks: extractLinks(caption),
        resolvedLinks: [],
        status: "pending",
        attempts: 0,
        extraction: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (created) postsNew++;
  }

  // Clubs that returned nothing but an error item → private / missing.
  const errorHandles = new Map<string, string>();
  for (const p of items) {
    if (p.shortCode) continue;
    const h = handleOf(p);
    if (h && (p.error || p.errorDescription)) errorHandles.set(h, `${p.error ?? ""} ${p.errorDescription ?? ""}`.toLowerCase());
  }

  const batch = db.batch();
  for (const handle of requestedHandles) {
    const club = clubs.get(handle);
    if (!club) continue;
    const s = seen.get(handle);
    const err = errorHandles.get(handle);
    const update: Record<string, unknown> = { lastScrapedAt: FieldValue.serverTimestamp() };
    if (s) {
      // Club added with just a handle: use the Instagram display name.
      const ownerName = posts.find((p) => handleOf(p) === handle)?.ownerFullName?.trim();
      if (ownerName && club.name === handle) update.name = ownerName;
      update["stats.postsScraped"] = FieldValue.increment(s.count);
      update.scrapeStatus = "ok";
      if (s.newest && (!club.lastPostAt || s.newest > club.lastPostAt)) update.lastPostAt = Timestamp.fromDate(s.newest);
    } else if (err) {
      // "no_items" ("Empty or private data") is what Apify returns when a public
      // account simply has no posts in the window, so don't flag it as private.
      update.scrapeStatus = /no_items/.test(err)
        ? "ok"
        : /private/.test(err)
          ? "private"
          : /not.?found|exist|missing/.test(err)
            ? "missing"
            : "error";
    }
    batch.update(db.collection("clubs").doc(club.id), update);
  }
  await batch.commit();
  revalidateTag(TAGS.clubs, "max");
  return { postsNew, itemsTotal: items.length, apifyCost: items.length * APIFY_COST_PER_RESULT };
}

/** Step 2: process pending posts until the time budget runs out. */
export async function processPending(opts: { budgetMs: number; runDocId?: string; limit?: number }) {
  const started = Date.now();
  const db = adminDb();
  const snap = await db
    .collection("posts")
    .where("status", "==", "pending")
    .orderBy("postedAt", "desc")
    // One extra doc so `remaining` stays > 0 when there's a backlog beyond this batch
    // (otherwise a full batch looks like "all done" and the chain stops).
    .limit((opts.limit ?? 25) + 1)
    .get();
  const totals = { processed: 0, eventsCreated: 0, eventsMerged: 0, llmCost: 0, errors: [] as string[], remaining: 0 };
  let i = 0;
  for (const doc of snap.docs.slice(0, opts.limit ?? 25)) {
    if (Date.now() - started > opts.budgetMs) break;
    i++;
    try {
      const r = await processPost(doc.ref);
      totals.processed++;
      totals.eventsCreated += r.created;
      totals.eventsMerged += r.merged;
      totals.llmCost += r.costUsd;
    } catch (e) {
      const msg = `${doc.id}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
      totals.errors.push(msg);
      const attempts = (doc.get("attempts") ?? 0) + 1;
      await doc.ref.update({
        attempts,
        status: attempts >= 3 ? "failed" : "pending",
        "extraction.error": msg,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
  totals.remaining = snap.size - i;
  if (totals.eventsCreated || totals.eventsMerged) revalidateTag(TAGS.events, "max");
  if (opts.runDocId && (totals.processed || totals.errors.length)) {
    await db.collection("scrapeRuns").doc(opts.runDocId).update({
      postsProcessed: FieldValue.increment(totals.processed),
      eventsCreated: FieldValue.increment(totals.eventsCreated),
      eventsMerged: FieldValue.increment(totals.eventsMerged),
      "costEstimate.llm": FieldValue.increment(totals.llmCost),
      // arrayUnion() with no arguments throws, so only include errors when there are some.
      ...(totals.errors.length ? { errors: FieldValue.arrayUnion(...totals.errors) } : {}),
    }).catch((e) => console.error("run stats update failed", e));
  }
  return totals;
}

/** Process one post: copy images, resolve links, extract with the LLM, write events. */
export async function processPost(ref: DocumentReference) {
  const db = adminDb();
  const post = (await ref.get()).data();
  if (!post) throw new Error("post missing");
  const clubSnap = await db.collection("clubs").doc(post.clubId).get();
  const club = clubSnap.data();
  if (!club || club.optOut) {
    await ref.update({ status: "no_event", updatedAt: FieldValue.serverTimestamp() });
    return { created: 0, merged: 0, costUsd: 0 };
  }

  // 1. Images → Blob (skip if already copied on a previous attempt).
  let images: ProcessedImage[] = post.processedImages ?? [];
  if (!images.length && post.sourceImageUrls?.length) {
    const results = await Promise.allSettled(
      (post.sourceImageUrls as string[]).map((u, i) => processImage(u, `posters/${post.shortcode}/${i}`)),
    );
    images = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (!images.length) throw new Error("No images could be downloaded (IG URL may have expired)");
    await ref.update({ processedImages: images, imagePaths: images.map((im) => im.sizes.lg) });
  }

  // 2. Links in the caption (and the bio link when the caption says "link in bio").
  const rawLinks: string[] = [...(post.rawLinks ?? [])];
  if (/link in (our )?bio|linktree|bio link/i.test(post.caption) && club.website) rawLinks.push(club.website);
  const resolved = rawLinks.length ? await resolveLinks([...new Set(rawLinks)].slice(0, 5)) : [];

  // 3. Vision LLM.
  const { result, model, costUsd, raw } = await extractEvents({
    clubName: club.name,
    handle: club.igHandle,
    caption: post.caption ?? "",
    postedAt: post.postedAt.toDate(),
    imageUrls: images.map((im) => im.sizes.md),
    links: resolved,
  });

  const extraction = { model, raw, confidence: result.confidence, error: null, costUsd };
  if (!result.isEventPost || !result.items.length) {
    await ref.update({ status: "no_event", resolvedLinks: resolved, extraction, updatedAt: FieldValue.serverTimestamp() });
    return { created: 0, merged: 0, costUsd };
  }

  // 4. Write events (dedupe + merge).
  const poster = images[0]
    ? { ...images[0], altText: result.posterAltText ?? `Poster from ${club.name}` }
    : null;
  let created = 0;
  let merged = 0;
  const lowConfidence = result.confidence < AUTO_PUBLISH_CONFIDENCE;
  for (const [idx, item] of result.items.entries()) {
    const r = await upsertEvent({
      id: result.items.length === 1 ? post.shortcode : `${post.shortcode}-${idx}`,
      item,
      club: { id: clubSnap.id, name: club.name },
      postId: post.shortcode,
      confidence: result.confidence,
      poster,
      imagePaths: images.map((im) => im.sizes.lg),
      needsReview: lowConfidence,
    });
    if (r === "created") created++;
    else merged++;
  }
  await db.collection("clubs").doc(clubSnap.id).update({ "stats.eventsFound": FieldValue.increment(created) });
  await ref.update({
    status: lowConfidence ? "needs_review" : "extracted",
    resolvedLinks: resolved,
    extraction,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { created, merged, costUsd };
}

/** Lowercase word set for fuzzy title matching. */
const words = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const STOP = new Set(["the", "and", "for", "with", "our", "your", "join", "club", "berkeley", "cal", "ucb", "event", "night"]);
export function titleSimilarity(a: string, b: string) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.min(A.size, B.size);
}

/**
 * Teaser + reminder + "tonight!" posts describe the same event. Merge into an
 * existing event from the same club within ±1 day with a similar title.
 */
async function upsertEvent(a: {
  id: string;
  item: ExtractedItem;
  club: { id: string; name: string };
  postId: string;
  confidence: number;
  poster: (ProcessedImage & { altText: string }) | null;
  imagePaths: string[];
  needsReview: boolean;
}): Promise<"created" | "merged"> {
  const db = adminDb();
  const it = a.item;
  const when = it.kind === "deadline" ? it.deadlineAt : it.startAt;
  const sortAt = when ? new Date(when) : null;
  const missingDate = !sortAt;
  const status = a.needsReview || missingDate ? "needs_review" : "published";

  if (sortAt) {
    const near = await db
      .collection("events")
      .where("clubId", "==", a.club.id)
      .where("sortAt", ">=", Timestamp.fromMillis(sortAt.getTime() - 86_400_000))
      .where("sortAt", "<=", Timestamp.fromMillis(sortAt.getTime() + 86_400_000))
      .get();
    const match = near.docs.find((d) => d.get("kind") === it.kind && titleSimilarity(d.get("title"), it.title) >= 0.6);
    if (match) {
      const e = match.data();
      const patch: Record<string, unknown> = {
        sourcePostIds: FieldValue.arrayUnion(a.postId),
        updatedAt: FieldValue.serverTimestamp(),
      };
      // Fill only empty fields; never overwrite admin edits.
      const fill = (k: string, v: unknown) => {
        if ((e[k] === null || e[k] === undefined || e[k] === "") && v !== null && v !== undefined && v !== "") patch[k] = v;
      };
      fill("endAt", it.endAt ? Timestamp.fromDate(new Date(it.endAt)) : null);
      fill("description", it.description);
      // Merge structured details: union list fields, keep existing scalars.
      const d = e.details ?? {};
      const uni = <T,>(a: T[] = [], b: T[] = []) => [...new Map([...a, ...b].map((x) => [JSON.stringify(x), x])).values()];
      patch.details = {
        highlights: uni(d.highlights, it.details.highlights).slice(0, 6),
        partners: uni(d.partners, it.details.partners),
        speakers: uni(d.speakers, it.details.speakers),
        audience: d.audience ?? it.details.audience,
        agenda: d.agenda?.length ? d.agenda : it.details.agenda,
        perks: uni(d.perks, it.details.perks),
        requirements: uni(d.requirements, it.details.requirements),
        rsvpRequired: d.rsvpRequired ?? it.details.rsvpRequired,
      };
      fill("recurrence", it.recurrence);
      if (!e.location?.name && it.location.name) patch.location = it.location;
      for (const k of ["rsvp", "tickets", "application"] as const) {
        if (!e.links?.[k] && it.links[k]) patch[`links.${k}`] = it.links[k];
      }
      if (it.links.info.length) patch["links.info"] = FieldValue.arrayUnion(...it.links.info);
      if (it.tags.length) patch.tags = FieldValue.arrayUnion(...it.tags);
      if (it.freeFood && !e.freeFood) patch.freeFood = true;
      if (!e.poster && a.poster) {
        patch.poster = a.poster;
        patch.posterPath = a.poster.sizes.lg;
      }
      if (a.confidence > (e.confidence ?? 0)) patch.confidence = a.confidence;
      await match.ref.update(patch);
      return "merged";
    }
  }

  const [vector] = await embed([embeddingText({ ...it, clubName: a.club.name })]).catch(() => [undefined]);
  await db.collection("events").doc(a.id).set({
    clubId: a.club.id,
    clubName: a.club.name,
    sourcePostIds: [a.postId],
    title: it.title,
    summary: it.summary,
    description: it.description ?? "",
    details: it.details,
    kind: it.kind,
    startAt: it.startAt ? Timestamp.fromDate(new Date(it.startAt)) : null,
    endAt: it.endAt ? Timestamp.fromDate(new Date(it.endAt)) : null,
    allDay: it.allDay,
    deadlineAt: it.deadlineAt ? Timestamp.fromDate(new Date(it.deadlineAt)) : null,
    sortAt: Timestamp.fromDate(sortAt ?? new Date()),
    recurrence: it.recurrence,
    location: it.location,
    categories: it.categories,
    tags: it.tags,
    cost: it.cost,
    freeFood: it.freeFood,
    links: it.links,
    posterPath: a.poster?.sizes.lg ?? null,
    imagePaths: a.imagePaths,
    poster: a.poster,
    confidence: a.confidence,
    uncertainFields: missingDate ? [...new Set([...it.uncertainFields, it.kind === "deadline" ? "deadlineAt" : "startAt"])] : it.uncertainFields,
    status,
    bookmarkCount: 0,
    ...(vector ? { embedding: FieldValue.vector(vector) } : {}),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    publishedAt: status === "published" ? FieldValue.serverTimestamp() : null,
  });
  return "created";
}
