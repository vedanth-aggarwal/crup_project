"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, GitMerge, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/brand/empty-state";
import { EventEditor } from "./event-editor";
import { mergeEvents, setEventStatus } from "@/app/admin/actions";
import { formatWhen } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { EventView } from "@/lib/types";
import type { PostView } from "@/lib/server/admin-data";

export function ReviewQueue({ events, posts, mergeCandidates }: { events: EventView[]; posts: Record<string, PostView>; mergeCandidates: EventView[] }) {
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const list = events.filter((e) => !removed.has(e.id));
  const [i, setI] = useState(0);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);
  const current = list[Math.min(i, list.length - 1)];
  const post = current ? posts[current.sourcePostIds[0] ?? ""] : undefined;

  const done = useCallback(
    (id: string) => {
      setRemoved((r) => new Set(r).add(id));
      router.refresh();
    },
    [router],
  );

  const decide = useCallback(
    (status: "published" | "hidden") => {
      if (!current) return;
      const id = current.id;
      start(async () => {
        const r = await setEventStatus(id, status);
        if (!r.ok) return void toast.error(r.error);
        toast.success(r.message ?? "Done");
        done(id);
      });
    },
    [current, done],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable], [role=combobox], [role=dialog]") || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === "j") setI((x) => Math.min(x + 1, list.length - 1));
      else if (k === "k") setI((x) => Math.max(x - 1, 0));
      else if (k === "a") decide("published");
      else if (k === "r") decide("hidden");
      else if (k === "e") {
        e.preventDefault();
        titleRef.current?.focus();
      } else if (k === "m") setMergeOpen(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length, decide]);

  if (!current) {
    return <EmptyState title="Queue is clear" description="Nothing needs review. Low-confidence extractions show up here." />;
  }

  const candidates = mergeCandidates.filter((c) => c.clubId === current.clubId && c.id !== current.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
      <ol className="max-h-[75vh] space-y-1 overflow-y-auto lg:sticky lg:top-6" aria-label="Queue">
        {list.map((e, idx) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => setI(idx)}
              aria-current={idx === i ? "true" : undefined}
              className={cn("w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent", idx === i && "bg-accent")}
            >
              <div className="truncate font-medium">{e.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {e.clubName} · {Math.round(e.confidence * 100)}%
              </div>
            </button>
          </li>
        ))}
      </ol>

      <section className="space-y-3" aria-label="Original post">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{Math.round(current.confidence * 100)}% confidence</Badge>
            {current.uncertainFields.length > 0 && <span className="text-xs text-warning">Unsure: {current.uncertainFields.join(", ")}</span>}
          </div>
          {post && (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Instagram <ArrowUpRight className="size-3" aria-hidden />
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(post?.imagePaths.length ? post.imagePaths : current.imagePaths).slice(0, 4).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="w-full rounded-md border object-cover" />
          ))}
        </div>
        {post && (
          <div className="space-y-2 rounded-md border bg-card p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              @{post.handle} · posted {post.postedAt ? formatWhen(post.postedAt, null, false) : "?"}
            </p>
            <p className="whitespace-pre-wrap">{post.caption || <em className="text-muted-foreground">No caption</em>}</p>
            {post.resolvedLinks.length > 0 && (
              <ul className="space-y-0.5 border-t pt-2 text-xs">
                {post.resolvedLinks.map((l) => (
                  <li key={l.url} className="truncate">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{l.title ?? l.url}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Keys: <kbd>J</kbd>/<kbd>K</kbd> next/prev · <kbd>A</kbd> approve · <kbd>R</kbd> reject · <kbd>E</kbd> edit · <kbd>M</kbd> merge
        </p>
      </section>

      <section aria-label="Extracted fields">
        <EventEditor
          key={current.id}
          ref={titleRef}
          event={current}
          onSaved={() => done(current.id)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => decide("published")} disabled={pending}>
                <Check aria-hidden /> Approve as is
              </Button>
              <Button type="button" variant="ghost" onClick={() => decide("hidden")} disabled={pending}>
                <X aria-hidden /> Reject
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMergeOpen(true)}>
                <GitMerge aria-hidden /> Merge…
              </Button>
            </>
          }
        />
      </section>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge into another event</DialogTitle>
            <DialogDescription>“{current.title}” will be folded into the event you pick, and then deleted.</DialogDescription>
          </DialogHeader>
          {candidates.length ? (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() =>
                      start(async () => {
                        const r = await mergeEvents(current.id, c.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Merged");
                        setMergeOpen(false);
                        done(current.id);
                      })
                    }
                  >
                    <div className="font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatWhen(c.startAt ?? c.deadlineAt, c.endAt, c.allDay)} · {c.status}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No other events from {current.clubName} to merge with.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
