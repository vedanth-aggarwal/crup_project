import { FieldValue } from "firebase-admin/firestore";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { z } from "zod";
import { openai } from "@/lib/server/openai";
import { env } from "@/lib/server/env";
import { adminDb } from "@/lib/server/firebase-admin";
import { getSessionUser } from "@/lib/server/session";
import { TOOL_DEFS, runTool } from "@/lib/server/chat-tools";
import { toggleBookmark } from "@/app/actions";
import type { EventView } from "@/lib/types";

export const maxDuration = 60;

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .min(1)
    .max(30),
});

function systemPrompt() {
  const now = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date());
  return `You are Clubo, a friendly assistant that helps UC Berkeley students find club events.
Right now it is ${now} (America/Los_Angeles). Resolve "tonight", "this weekend", "next week" from this. Weekends run Friday 5pm to Sunday night.

How to answer:
- Always look things up with tools before answering about events; never invent events, times, or places.
- Use search_events for concrete filters (dates, categories, free food). Use semantic_search for vibes/topics ("chill", "startups", "meet people", company names), passing date bounds when the question has a time range. You may call both.
- Keep replies short and scannable: a one-line intro, then the best 2–5 picks. For each pick, link it as a markdown link to its url, e.g. [Hack Night](/events/abc), plus when and where in a few words.
- If nothing matches, say so and suggest a broader search.
- Only use bookmark_event when the student explicitly asks to save something.
- Stay on topic (Berkeley clubs and events). Don't share personal opinions on politics or religion.`;
}

/** Per-user daily cap; returns false when over the limit. */
async function takeQuota(uid: string) {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const ref = adminDb().collection("chatUsage").doc(`${uid}_${day}`);
  return adminDb().runTransaction(async (tx) => {
    const n = ((await tx.get(ref)).get("count") as number | undefined) ?? 0;
    if (n >= env.chatDailyLimit) return false;
    tx.set(ref, { uid, day, count: FieldValue.increment(1) }, { merge: true });
    return true;
  });
}

/**
 * Streams NDJSON lines:
 *   {"t":"status","d":"Searching events…"} · {"t":"text","d":"…"} · {"t":"events","d":[...]} · {"t":"error","d":"…"} · {"t":"done"}
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in to chat with Clubo." }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  if (!(await takeQuota(user.uid))) {
    return Response.json({ error: `You've hit today's limit of ${env.chatDailyLimit} messages. Try again tomorrow.` }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`));
      const found = new Map<string, EventView>();
      const input: ResponseInputItem[] = [
        { role: "system", content: systemPrompt() },
        ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content }) as ResponseInputItem),
      ];
      const STATUS: Record<string, string> = {
        search_events: "Searching events…",
        semantic_search: "Looking for good matches…",
        get_event: "Checking the details…",
        list_clubs: "Looking up clubs…",
        bookmark_event: "Saving it…",
      };
      try {
        for (let round = 0; round < 5; round++) {
          const s = await openai().responses.create({
            model: env.chatModel,
            input,
            tools: TOOL_DEFS,
            stream: true,
          });
          let final: { output: Parameters<typeof toResponseInputItems>[0] } | null = null;
          for await (const ev of s) {
            if (ev.type === "response.output_text.delta") send({ t: "text", d: ev.delta });
            else if (ev.type === "response.output_item.added" && ev.item.type === "function_call") send({ t: "status", d: STATUS[ev.item.name] ?? "Working…" });
            else if (ev.type === "response.completed") final = ev.response;
            else if (ev.type === "response.failed" || ev.type === "error") throw new Error("The model request failed");
          }
          if (!final) throw new Error("No response");
          input.push(...toResponseInputItems(final.output));
          const calls = (final.output as { type: string; name?: string; arguments?: string; call_id?: string }[]).filter((o) => o.type === "function_call");
          if (!calls.length) break;
          for (const call of calls) {
            let result: unknown;
            try {
              result = await runTool(call.name!, call.arguments ?? "{}", {
                uid: user.uid,
                onEvents: (evs) => evs.forEach((e) => found.set(e.id, e)),
                bookmark: async (id) => (await toggleBookmark(id, true)).ok,
              });
            } catch (e) {
              result = { error: e instanceof Error ? e.message : "Tool failed" };
            }
            input.push({ type: "function_call_output", call_id: call.call_id!, output: JSON.stringify(result) });
          }
        }
        if (found.size) send({ t: "events", d: [...found.values()].slice(0, 12) });
        send({ t: "done" });
      } catch (e) {
        console.error(e);
        send({ t: "error", d: "Sorry, something went wrong. Try asking again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
