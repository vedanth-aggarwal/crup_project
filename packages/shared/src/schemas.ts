import { z } from "zod";
import { CATEGORIES } from "./categories";

/**
 * App-level models. Timestamps are JS Dates here; convert to/from Firestore
 * Timestamps at the edges (web: client SDK converter, functions: admin converter).
 */

export const categorySchema = z.enum(CATEGORIES);

// ---------- clubs/{clubId} ----------
export const clubSchema = z.object({
  name: z.string().min(1),
  igHandle: z.string().regex(/^[a-z0-9._]{1,30}$/, "lowercase IG handle without @"),
  category: z.array(categorySchema),
  description: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  website: z.string().url().nullable(),
  active: z.boolean(),
  scrapeIntervalHours: z.number().int().positive(),
  lastScrapedAt: z.date().nullable(),
  lastPostAt: z.date().nullable(),
  stats: z.object({ postsScraped: z.number().int(), eventsFound: z.number().int() }),
  /** Club asked to be removed: never scrape or show. */
  optOut: z.boolean(),
  /** Last scrape health; "private"/"missing" are flagged in admin. */
  scrapeStatus: z.enum(["ok", "private", "missing", "error"]).nullable(),
});
export type Club = z.infer<typeof clubSchema>;

// ---------- posts/{shortcode} ----------
export const postStatusSchema = z.enum(["pending", "extracted", "no_event", "needs_review", "failed"]);

export const resolvedLinkSchema = z.object({
  url: z.string().url(),
  title: z.string().nullable(),
  desc: z.string().nullable(),
});

export const postSchema = z.object({
  clubId: z.string(),
  shortcode: z.string(),
  url: z.string().url(),
  caption: z.string(),
  postedAt: z.date(),
  type: z.enum(["image", "carousel", "video"]),
  imagePaths: z.array(z.string()),
  rawLinks: z.array(z.string()),
  resolvedLinks: z.array(resolvedLinkSchema),
  status: postStatusSchema,
  extraction: z
    .object({
      model: z.string(),
      raw: z.unknown(),
      confidence: z.number().min(0).max(1).nullable(),
      error: z.string().nullable(),
    })
    .nullable(),
});
export type Post = z.infer<typeof postSchema>;

// ---------- Structured event details (so students don't have to read the poster) ----------
export const eventDetailsSchema = z.object({
  /** 2–5 short bullets: the most useful facts at a glance. */
  highlights: z.array(z.string()),
  /** Companies, co-hosting clubs, sponsors involved (e.g. "Uber", "SWE @ Berkeley"). */
  partners: z.array(z.string()),
  speakers: z.array(z.object({ name: z.string(), role: z.string().nullable() })),
  /** Who it's for / eligibility, e.g. "All majors, no experience needed". */
  audience: z.string().nullable(),
  agenda: z.array(z.object({ time: z.string().nullable(), item: z.string() })),
  /** Food, swag, prizes, networking, etc. */
  perks: z.array(z.string()),
  /** What to bring / do beforehand, e.g. "Bring a laptop", "RSVP required". */
  requirements: z.array(z.string()),
  rsvpRequired: z.boolean().nullable(),
});
export type EventDetails = z.infer<typeof eventDetailsSchema>;

export const EMPTY_EVENT_DETAILS: EventDetails = {
  highlights: [],
  partners: [],
  speakers: [],
  audience: null,
  agenda: [],
  perks: [],
  requirements: [],
  rsvpRequired: null,
};

// ---------- events/{eventId} ----------
export const eventStatusSchema = z.enum(["published", "needs_review", "hidden"]);

export const locationSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  isOnline: z.boolean(),
  campusBuilding: z.string().nullable(),
});

export const posterSchema = z.object({
  sizes: z.object({ sm: z.string(), md: z.string(), lg: z.string() }),
  width: z.number().int(),
  height: z.number().int(),
  /** Tiny base64 WebP used as the blurred placeholder while the poster loads. */
  blurDataUrl: z.string(),
  dominantColor: z.string(),
  altText: z.string(),
});

export const eventSchema = z.object({
  clubId: z.string(),
  clubName: z.string(),
  sourcePostIds: z.array(z.string()),
  title: z.string().min(1),
  summary: z.string(),
  description: z.string(),
  details: eventDetailsSchema,
  kind: z.enum(["event", "deadline"]),
  startAt: z.date().nullable(),
  endAt: z.date().nullable(),
  allDay: z.boolean(),
  deadlineAt: z.date().nullable(),
  /** startAt for events, deadlineAt for deadlines. Every list query orders by this. */
  sortAt: z.date(),
  recurrence: z.string().nullable(),
  location: locationSchema,
  categories: z.array(categorySchema),
  tags: z.array(z.string()),
  cost: z.object({ isFree: z.boolean().nullable(), price: z.string().nullable() }),
  freeFood: z.boolean(),
  links: z.object({
    rsvp: z.string().url().nullable(),
    tickets: z.string().url().nullable(),
    application: z.string().url().nullable(),
    info: z.array(z.string().url()),
  }),
  posterPath: z.string().nullable(),
  imagePaths: z.array(z.string()),
  poster: posterSchema.nullable(),
  confidence: z.number().min(0).max(1),
  /** Fields the model flagged as uncertain; highlighted in the review queue. */
  uncertainFields: z.array(z.string()),
  status: eventStatusSchema,
  bookmarkCount: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ClubEvent = z.infer<typeof eventSchema>;

// ---------- users/{uid} ----------
export const notificationPrefsSchema = z.object({
  reminders: z.boolean(),
  reminderLeadHours: z.number().int().positive(),
  deadlines: z.boolean(),
  weeklyDigest: z.boolean(),
  newFromFollowed: z.boolean(),
});

export const DEFAULT_NOTIFICATION_PREFS: z.infer<typeof notificationPrefsSchema> = {
  reminders: true,
  reminderLeadHours: 24,
  deadlines: true,
  weeklyDigest: true,
  newFromFollowed: true,
};

export const userSchema = z.object({
  email: z.string().email(),
  name: z.string().nullable(),
  followedClubs: z.array(z.string()),
  followedCategories: z.array(categorySchema),
  notificationPrefs: notificationPrefsSchema,
});
export type User = z.infer<typeof userSchema>;

export const bookmarkSchema = z.object({
  createdAt: z.date(),
  eventStartAt: z.date().nullable(),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;

// ---------- LLM extraction output (strict JSON from the vision model) ----------
// Dates are ISO-8601 strings with offset, interpreted in America/Los_Angeles.
const isoOrNull = z.string().datetime({ offset: true }).nullable();

export const extractedItemSchema = z.object({
  kind: z.enum(["event", "deadline"]),
  title: z.string(),
  description: z.string().nullable(),
  startAt: isoOrNull,
  endAt: isoOrNull,
  allDay: z.boolean(),
  deadlineAt: isoOrNull,
  recurrence: z.string().nullable(),
  location: locationSchema,
  categories: z.array(categorySchema),
  tags: z.array(z.string()),
  cost: z.object({ isFree: z.boolean().nullable(), price: z.string().nullable() }),
  freeFood: z.boolean(),
  links: z.object({
    rsvp: z.string().nullable(),
    tickets: z.string().nullable(),
    application: z.string().nullable(),
    info: z.array(z.string()),
  }),
  /** One or two sentences for the card. */
  summary: z.string(),
  details: eventDetailsSchema,
  /** Field names the model is unsure about (e.g. "startAt" when the year was guessed). */
  uncertainFields: z.array(z.string()),
});

export const extractionResultSchema = z.object({
  isEventPost: z.boolean(),
  confidence: z.number().min(0).max(1),
  posterAltText: z.string().nullable(),
  items: z.array(extractedItemSchema),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/** Extraction results at or above this confidence publish automatically. */
export const AUTO_PUBLISH_CONFIDENCE = 0.7;
