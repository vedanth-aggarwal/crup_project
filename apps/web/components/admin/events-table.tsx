"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EventEditor } from "./event-editor";
import { ActionButton } from "./action-button";
import { setEventStatus } from "@/app/admin/actions";
import { formatWhen } from "@/lib/dates";
import { matchesText } from "@/lib/filters";
import type { EventView } from "@/lib/types";

const STATUSES = ["all", "published", "needs_review", "hidden"] as const;

export function EventsTable({ events }: { events: EventView[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [editing, setEditing] = useState<EventView | null>(null);
  const router = useRouter();
  const rows = useMemo(
    () => events.filter((e) => (status === "all" || e.status === status) && matchesText(e, q)),
    [events, q, status],
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search title, club, tags…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
              {s.replace("_", " ")}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} shown</span>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Conf.</TableHead>
              <TableHead className="text-right">Saves</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="max-w-80">
                  <button type="button" onClick={() => setEditing(e)} className="block max-w-full truncate text-left font-medium hover:underline">
                    {e.title}
                  </button>
                  <div className="truncate text-xs text-muted-foreground">{e.clubName}{e.kind === "deadline" ? " · deadline" : ""}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatWhen(e.kind === "deadline" ? e.deadlineAt : e.startAt, e.endAt, e.allDay)}
                </TableCell>
                <TableCell>
                  <Badge variant={e.status === "published" ? "secondary" : e.status === "hidden" ? "outline" : "default"}>{e.status.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{Math.round(e.confidence * 100)}%</TableCell>
                <TableCell className="text-right font-mono text-sm">{e.bookmarkCount}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Edit</Button>
                  {e.status === "published" ? (
                    <ActionButton size="sm" variant="ghost" action={() => setEventStatus(e.id, "hidden")}>Hide</ActionButton>
                  ) : (
                    <ActionButton size="sm" variant="ghost" action={() => setEventStatus(e.id, "published")}>Publish</ActionButton>
                  )}
                  {e.status === "published" && (
                    <Button asChild size="sm" variant="ghost"><Link href={`/events/${e.id}`} target="_blank">View</Link></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Edit event</SheetTitle>
            <SheetDescription>{editing?.clubName}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {editing && (
              <EventEditor
                key={editing.id}
                event={editing}
                onSaved={() => {
                  setEditing(null);
                  router.refresh();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
