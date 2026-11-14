"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Loader2, RotateCcw, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";
import { InlineEventCard } from "./inline-event-card";
import { cn } from "@/lib/utils";
import type { EventView } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string; events?: EventView[]; status?: string; error?: boolean };

const SUGGESTIONS = ["Free food this week?", "Tech events Friday", "Something chill to meet people this weekend", "Which deadlines close soon?"];

/** Events the answer links to (/events/:id), in mention order; falls back to the top results. */
function cardsFor(text: string, events: EventView[]) {
  const ids = [...text.matchAll(/\/events\/([\w-]+)/g)].map((m) => m[1]);
  const byId = new Map(events.map((e) => [e.id, e]));
  const linked = [...new Set(ids)].map((id) => byId.get(id!)).filter((e): e is EventView => !!e);
  return (linked.length ? linked : events).slice(0, 4);
}

export function ChatPanel({ signedIn, initialQuestion }: { signedIn: boolean; initialQuestion?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      const history: Msg[] = [...messages, { role: "user", content: q }];
      setMessages([...history, { role: "assistant", content: "", status: "Thinking…" }]);
      setBusy(true);
      const ac = new AbortController();
      abort.current = ac;
      const patch = (fn: (m: Msg) => Msg) => setMessages((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1]!)]);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          patch((m) => ({ ...m, content: err.error ?? "Something went wrong.", status: undefined, error: true }));
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as { t: string; d?: unknown };
            if (ev.t === "text") patch((m) => ({ ...m, content: m.content + (ev.d as string), status: undefined }));
            else if (ev.t === "status") patch((m) => ({ ...m, status: ev.d as string }));
            else if (ev.t === "events") patch((m) => ({ ...m, events: ev.d as EventView[] }));
            else if (ev.t === "error") patch((m) => ({ ...m, content: (m.content ? `${m.content}\n\n` : "") + (ev.d as string), error: true, status: undefined }));
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") patch((m) => ({ ...m, content: "Connection lost. Try again.", error: true, status: undefined }));
      } finally {
        patch((m) => ({ ...m, status: undefined }));
        setBusy(false);
        abort.current = null;
      }
    },
    [busy, messages],
  );

  useEffect(() => {
    if (initialQuestion && signedIn && !asked.current) {
      asked.current = true;
      void send(initialQuestion);
    }
  }, [initialQuestion, signedIn, send]);

  if (!signedIn) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-gold/20">
          <Sparkles className="size-6 text-gold" aria-hidden />
        </span>
        <h1 className="font-display text-5xl">Ask Clubo</h1>
        <p className="text-muted-foreground">&ldquo;Anything with free food tonight?&rdquo; &ldquo;Tech events next week?&rdquo; Ask in plain English and get real events back.</p>
        <Button asChild size="lg" className="rounded-full px-6">
          <Link href="/login?next=/chat">Sign in to chat</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem-3rem)] max-w-3xl flex-col md:h-[calc(100dvh-4rem-3.5rem)]">
      <div ref={scroller} className="flex-1 space-y-6 overflow-y-auto pb-6" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="space-y-2">
              <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-gold/20">
                <Sparkles className="size-5 text-gold" aria-hidden />
              </span>
              <h1 className="font-display text-5xl">Ask Clubo</h1>
              <p className="text-sm text-muted-foreground">I search every club event at Berkeley so you don&rsquo;t have to.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border bg-card px-4 py-2 text-sm hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-foreground">{m.content}</p>
              </div>
            ) : (
              <div key={i} className="space-y-3">
                <div className={cn("space-y-2 text-[15px] leading-relaxed", m.error && "text-danger")}>
                  {m.content ? <Markdown text={m.content} /> : null}
                  {m.status && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> {m.status}
                    </p>
                  )}
                </div>
                {!m.status && m.events && m.events.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {cardsFor(m.content, m.events).map((e) => (
                      <InlineEventCard key={e.id} event={e} />
                    ))}
                  </div>
                )}
              </div>
            ),
          )
        )}
      </div>
      <form
        className="sticky bottom-0 flex items-end gap-2 border-t bg-background pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        {messages.length > 0 && !busy && (
          <Button type="button" variant="ghost" size="icon" aria-label="New conversation" onClick={() => setMessages([])} className="size-11 shrink-0">
            <RotateCcw />
          </Button>
        )}
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask about events, clubs, deadlines…"
            className="max-h-40 min-h-11 w-full resize-none rounded-3xl border bg-card px-4 py-2.5 text-[15px] outline-none field-sizing-content focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        {busy ? (
          <Button type="button" size="icon" variant="outline" aria-label="Stop" onClick={() => abort.current?.abort()} className="size-11 shrink-0 rounded-full">
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim()} className="size-11 shrink-0 rounded-full">
            <ArrowUp />
          </Button>
        )}
      </form>
    </div>
  );
}
