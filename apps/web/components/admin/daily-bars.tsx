"use client";

import { useState } from "react";

type Day = { day: string; value: number };

/** Single-series daily bar chart: one hue, 4px rounded tops, hover tooltip, table for screen readers. */
export function DailyBars({ title, data, currency }: { title: string; data: Day[]; currency?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const format = (v: number) => (currency ? `$${v.toFixed(2)}` : String(v));
  const max = Math.max(1e-9, ...data.map((d) => d.value));
  const label = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
  return (
    <figure className="rounded-lg border bg-card p-4">
      <figcaption className="mb-3 text-sm font-medium">{title}</figcaption>
      <div className="relative flex h-32 items-end gap-[2px]" onMouseLeave={() => setHover(null)} aria-hidden>
        {data.map((d, i) => (
          <div key={d.day} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className={`w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-brand" : "bg-brand/70"}`}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }}
            />
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
                <span className="text-muted-foreground">{label(d.day)}</span> · <span className="font-medium">{format(d.value)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground" aria-hidden>
        <span>{label(data[0]?.day ?? "")}</span>
        <span>{label(data.at(-1)?.day ?? "")}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th>{label(d.day)}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
