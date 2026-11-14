"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CATEGORY_META } from "@clubo/shared";
import { Button } from "@/components/ui/button";
import { ptDayKey, startOfPtDay, timeRange } from "@/lib/dates";
import type { EventView } from "@/lib/types";
import { cn } from "@/lib/utils";

const START_HOUR = 8;
const END_HOUR = 24;
const HOUR_PX = 44;
const DAY_MS = 86_400_000;

const hourOfPt = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(d);
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24;
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h + m / 60;
};

export function WeekView({ events }: { events: EventView[] }) {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const start = new Date(startOfPtDay(now).getTime() + offset * 7 * DAY_MS);
  const days = Array.from({ length: 7 }, (_, i) => startOfPtDay(new Date(start.getTime() + i * DAY_MS + 3 * 3600_000)));
  const timed = events.filter((e) => e.kind === "event" && e.startAt);
  const fmtDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", day: "numeric" });
  const fmtRange = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });
  const todayKey = ptDayKey(now);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium">
          {fmtRange.format(days[0]!)} – {fmtRange.format(days[6]!)}
        </p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setOffset((o) => o - 1)} disabled={offset <= 0}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="grid min-w-[720px]" style={{ gridTemplateColumns: "48px repeat(7, minmax(0, 1fr))" }}>
          <div />
          {days.map((d) => (
            <div key={d.toISOString()} className={cn("border-b border-l px-2 py-2 text-center text-xs font-medium", ptDayKey(d) === todayKey && "text-brand")}>
              {fmtDay.format(d)}
            </div>
          ))}
          <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <span key={i} className="absolute right-1.5 -translate-y-1/2 font-mono text-[10px] text-muted-foreground" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : `${((START_HOUR + i + 11) % 12) + 1}${START_HOUR + i < 12 ? "a" : "p"}`}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const key = ptDayKey(d);
            const dayEvents = timed.filter((e) => ptDayKey(new Date(e.startAt!)) === key);
            return (
              <div key={key} className="relative border-l" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-dashed border-border/60" style={{ top: i * HOUR_PX }} />
                ))}
                {key === todayKey && (() => {
                  const h = hourOfPt(now);
                  if (h < START_HOUR) return null;
                  return (
                    <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: (h - START_HOUR) * HOUR_PX }} aria-hidden>
                      <span className="-ml-1 size-2 rounded-full bg-danger" />
                      <span className="h-px flex-1 bg-danger" />
                    </div>
                  );
                })()}
                {dayEvents.map((e) => {
                  const s = new Date(e.startAt!);
                  const end = e.endAt ? new Date(e.endAt) : new Date(s.getTime() + 90 * 60_000);
                  const top = Math.max(0, (hourOfPt(s) - START_HOUR) * HOUR_PX);
                  const height = Math.max(26, ((end.getTime() - s.getTime()) / 3600_000) * HOUR_PX - 2);
                  const hue = e.categories[0] ? CATEGORY_META[e.categories[0]].hue : 255;
                  return (
                    <Link
                      key={e.id}
                      href={`/events/${e.id}`}
                      scroll={false}
                      className="cat-chip absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-[11px] leading-tight shadow-sm hover:z-20 hover:shadow-md"
                      style={{ top, height, "--hue": hue, borderLeftColor: `oklch(0.6 0.15 ${hue})` } as React.CSSProperties}
                    >
                      <span className="block truncate font-semibold">{e.title}</span>
                      <span className="block truncate opacity-80">{timeRange(s, e.endAt ? end : null)}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
