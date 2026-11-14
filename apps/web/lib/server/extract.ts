import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { CATEGORIES, extractionResultSchema, type ExtractionResult } from "@clubo/shared";
import { openai, estimateCost } from "./openai";
import { env } from "./env";
import type { ResolvedLink } from "./links";

/**
 * Model-facing schema: plain types only (strict structured outputs), no
 * refinements. Normalised + validated against the shared schema afterwards.
 */
const llmItem = z.object({
  kind: z.enum(["event", "deadline"]),
  title: z.string().describe("Short, clean event title. No emojis, no club name unless part of the event's name."),
  summary: z.string().describe("1–2 plain sentences for a card: what it is and why go."),
  description: z
    .string()
    .describe(
      "A complete, well-written description (2–4 short paragraphs) combining everything known from the poster text, caption and linked pages: what happens, who it's with, why attend, logistics. Rewrite in plain prose; never just repeat the summary.",
    ),
  startAt: z.string().nullable().describe("ISO 8601 with offset, America/Los_Angeles. Null if unknown."),
  endAt: z.string().nullable(),
  allDay: z.boolean(),
  deadlineAt: z.string().nullable().describe("For kind=deadline (applications, RSVP, tickets): when it closes. ISO 8601 with offset."),
  recurrence: z.string().nullable().describe('Human text like "Every Tuesday" if recurring, else null.'),
  location: z.object({
    name: z.string().nullable().describe('As written, e.g. "Dwinelle 155" or "Memorial Glade".'),
    address: z.string().nullable(),
    isOnline: z.boolean(),
    campusBuilding: z.string().nullable().describe('UC Berkeley building name if on campus, e.g. "Dwinelle Hall".'),
  }),
  categories: z.array(z.enum(CATEGORIES)).describe("1–3 best-fitting categories."),
  tags: z.array(z.string()).describe('2–6 lowercase tags students would search: "boba", "networking", "free food", company names.'),
  cost: z.object({ isFree: z.boolean().nullable(), price: z.string().nullable() }),
  freeFood: z.boolean(),
  links: z.object({
    rsvp: z.string().nullable(),
    tickets: z.string().nullable(),
    application: z.string().nullable(),
    info: z.array(z.string()),
  }),
  details: z.object({
    highlights: z.array(z.string()).describe("2–5 short bullet points of the most useful facts (≤ 12 words each), e.g. 'Q&A with Uber engineers', 'Resume drop for internships'."),
    partners: z.array(z.string()).describe("Companies, sponsors, co-hosting clubs or orgs named on the poster/caption."),
    speakers: z.array(z.object({ name: z.string(), role: z.string().nullable().describe("Title + company, e.g. 'Senior SWE at Uber'.") })),
    audience: z.string().nullable().describe("Who it's for / eligibility, e.g. 'All majors, no experience needed' or 'Members only'."),
    agenda: z.array(z.object({ time: z.string().nullable().describe("e.g. '6:00 PM'"), item: z.string() })).describe("Schedule items if listed."),
    perks: z.array(z.string()).describe("Food, swag, prizes, raffles, networking, certificates…"),
    requirements: z.array(z.string()).describe("What to bring or do first: 'Bring a laptop', 'RSVP required', 'Cal ID needed'."),
    rsvpRequired: z.boolean().nullable(),
  }),
  uncertainFields: z.array(z.string()).describe('Names of fields you had to guess, e.g. ["startAt","location"].'),
});

const llmResult = z.object({
  isEventPost: z.boolean().describe("False for recaps, memes, member spotlights, generic announcements without a date."),
  confidence: z.number().describe("0–1: how sure you are the extracted items are correct and complete."),
  posterAltText: z.string().nullable().describe("Alt text describing the poster for screen-reader users, ≤ 200 chars."),
  items: z.array(llmItem),
});

const SYSTEM = `You extract UC Berkeley student-club events from Instagram posts (poster images + caption + linked pages).

Rules:
- Output every distinct event or deadline in the post. A weekly lineup poster can hold several events. A recruiting post usually has a deadline (applications close) and sometimes info sessions (events).
- Recaps ("thanks for coming!"), throwbacks, member spotlights, and posts with no future date → isEventPost=false, items=[].
- Resolve relative dates ("this Thursday", "tmrw", "next week") against the post's publish date. Posters often omit the year: pick the next occurrence on or after the post date.
- All times are America/Los_Angeles. Output ISO 8601 with the correct offset (-07:00 during daylight time, -08:00 otherwise).
- If a time range is given, set endAt. If only a date is known, set allDay=true and startAt to midnight local.
- Never invent details. Unknown → null. Put fields you guessed in uncertainFields.
- Only use links that actually appear in the caption or resolved pages. Classify each: rsvp / tickets / application; everything else into info.
- freeFood=true only when food is explicitly offered for free (e.g. "free pizza", "food provided").
- Lower confidence when the date, time or location is ambiguous, the poster is hard to read, or the year was guessed.
- Read the poster text carefully: speakers, companies, agendas, prizes and eligibility are often only on the image. Put them in the structured details so students never have to read the poster to understand the event. Use empty arrays when something isn't mentioned.`;

export type ExtractInput = {
  clubName: string;
  handle: string;
  caption: string;
  postedAt: Date;
  imageUrls: string[];
  links: ResolvedLink[];
};

export async function extractEvents(input: ExtractInput): Promise<{ result: ExtractionResult; model: string; costUsd: number; raw: unknown }> {
  const posted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(input.postedAt);

  const linkText = input.links.length
    ? input.links.map((l) => `- ${l.url}\n  title: ${l.title ?? "?"}\n  ${l.desc ?? ""}`).join("\n")
    : "(none)";

  const model = env.extractionModel;
  const response = await openai().responses.parse({
    model,
    input: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Club: ${input.clubName} (@${input.handle})\nPosted: ${posted}\n\nCaption:\n"""\n${input.caption.slice(0, 4000)}\n"""\n\nLinked pages:\n${linkText}`,
          },
          ...input.imageUrls.map((url) => ({ type: "input_image" as const, image_url: url, detail: "auto" as const })),
        ],
      },
    ],
    text: { format: zodTextFormat(llmResult, "club_post_extraction") },
  });

  const parsed = response.output_parsed;
  if (!parsed) throw new Error("Model returned no parsable output");
  return {
    result: normalize(parsed),
    model,
    costUsd: estimateCost(model, response.usage),
    raw: parsed,
  };
}

const validIso = (s: string | null) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString().replace(".000Z", "Z") : null);
const validUrl = (s: string | null) => {
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`);
    return u.protocol.startsWith("http") ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Clean model output into the shared schema; anything invalid becomes null + uncertain. */
export function normalize(r: z.infer<typeof llmResult>): ExtractionResult {
  const items = r.items.map((it) => {
    const uncertain = new Set(it.uncertainFields);
    const fix = (k: "startAt" | "endAt" | "deadlineAt") => {
      const v = validIso(it[k]);
      if (it[k] && !v) uncertain.add(k);
      return v;
    };
    const startAt = fix("startAt");
    let endAt = fix("endAt");
    const deadlineAt = fix("deadlineAt");
    if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) {
      // "9pm–1am" style ranges cross midnight.
      const bumped = new Date(Date.parse(endAt) + 86_400_000).toISOString();
      endAt = Date.parse(bumped) - Date.parse(startAt) < 18 * 3600_000 ? bumped : null;
    }
    if (it.kind === "event" && !startAt) uncertain.add("startAt");
    // A deadline with only startAt set: the model put the date in the wrong field.
    if (it.kind === "deadline" && !deadlineAt) uncertain.add("deadlineAt");
    return {
      ...it,
      title: it.title.trim().slice(0, 140),
      description: it.description.trim().slice(0, 4000),
      details: {
        highlights: it.details.highlights.map((h) => h.trim()).filter(Boolean).slice(0, 6),
        partners: [...new Set(it.details.partners.map((p) => p.trim()).filter(Boolean))].slice(0, 10),
        speakers: it.details.speakers.filter((sp) => sp.name.trim()).slice(0, 10),
        audience: it.details.audience?.trim() || null,
        agenda: it.details.agenda.filter((a) => a.item.trim()).slice(0, 15),
        perks: it.details.perks.map((p) => p.trim()).filter(Boolean).slice(0, 8),
        requirements: it.details.requirements.map((r) => r.trim()).filter(Boolean).slice(0, 8),
        rsvpRequired: it.details.rsvpRequired,
      },
      summary: it.summary.trim().slice(0, 300),
      startAt: it.kind === "deadline" ? null : startAt,
      endAt: it.kind === "deadline" ? null : endAt,
      deadlineAt: it.kind === "deadline" ? (deadlineAt ?? startAt) : deadlineAt,
      categories: [...new Set(it.categories)].slice(0, 3),
      tags: [...new Set(it.tags.map((t) => t.toLowerCase().trim()).filter(Boolean))].slice(0, 8),
      links: {
        rsvp: validUrl(it.links.rsvp),
        tickets: validUrl(it.links.tickets),
        application: validUrl(it.links.application),
        info: it.links.info.map(validUrl).filter((u): u is string => !!u).slice(0, 5),
      },
      uncertainFields: [...uncertain],
    };
  });
  return extractionResultSchema.parse({
    isEventPost: r.isEventPost && items.length > 0,
    confidence: Math.min(1, Math.max(0, r.confidence)),
    posterAltText: r.posterAltText?.slice(0, 300) ?? null,
    items: r.isEventPost ? items : [],
  });
}
