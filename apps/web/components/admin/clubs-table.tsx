"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionButton } from "./action-button";
import { ClubAvatar } from "@/components/clubs/club-avatar";
import { deleteClub, scrapeNow, updateClub } from "@/app/admin/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ClubView } from "@/lib/types";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const h = (Date.now() - new Date(iso).getTime()) / 3600_000;
  return h < 1 ? "<1h ago" : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
};

type SortKey = "name" | "lastScrapedAt" | "eventsFound";

export function ClubsTable({ clubs }: { clubs: ClubView[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();

  const rows = useMemo(() => {
    const lq = q.toLowerCase();
    const list = clubs.filter((c) => !lq || c.name.toLowerCase().includes(lq) || c.igHandle.includes(lq));
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "eventsFound"
          ? b.stats.eventsFound - a.stats.eventsFound
          : (b.lastScrapedAt ?? "").localeCompare(a.lastScrapedAt ?? ""),
    );
  }, [clubs, q, sort]);

  const run = async (p: Promise<{ ok: boolean; error?: string; message?: string }>) => {
    const r = await p;
    if (r.ok) toast.success(r.message ?? "Saved");
    else toast.error(r.error ?? "Failed");
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search clubs" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        {selected.size > 0 && (
          <ActionButton size="sm" variant="outline" action={() => scrapeNow([...selected])}>
            <RefreshCw aria-hidden /> Scrape {selected.size} selected
          </ActionButton>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} clubs</span>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  aria-label="Select all"
                  checked={selected.size === rows.length && rows.length > 0}
                  onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())}
                />
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => setSort("name")} className="font-medium">Club {sort === "name" && "↓"}</button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <button type="button" onClick={() => setSort("lastScrapedAt")} className="font-medium">Last scraped {sort === "lastScrapedAt" && "↓"}</button>
              </TableHead>
              <TableHead className="text-right">Every</TableHead>
              <TableHead className="text-right">Posts</TableHead>
              <TableHead className="text-right">
                <button type="button" onClick={() => setSort("eventsFound")} className="font-medium">Events {sort === "eventsFound" && "↓"}</button>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${c.name}`}
                    checked={selected.has(c.id)}
                    onCheckedChange={(v) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (v) n.add(c.id);
                        else n.delete(c.id);
                        return n;
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ClubAvatar name={c.name} src={c.avatarUrl} size={28} />
                    <div>
                      <Link href={`/clubs/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      <div className="text-xs text-muted-foreground">@{c.igHandle}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {c.optOut ? (
                    <Badge variant="destructive">opted out</Badge>
                  ) : !c.active ? (
                    <Badge variant="outline">paused</Badge>
                  ) : c.scrapeStatus && c.scrapeStatus !== "ok" ? (
                    <Badge variant="destructive">{c.scrapeStatus}</Badge>
                  ) : (
                    <Badge variant="secondary">active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{ago(c.lastScrapedAt)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{c.scrapeIntervalHours}h</TableCell>
                <TableCell className="text-right font-mono text-sm">{c.stats.postsScraped}</TableCell>
                <TableCell className="text-right font-mono text-sm">{c.stats.eventsFound}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`Actions for ${c.name}`} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => run(scrapeNow([c.id]))}>Scrape now</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => run(updateClub(c.id, { active: !c.active }))}>{c.active ? "Pause" : "Resume"}</DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          const v = window.prompt("Scrape interval in hours (6–336)", String(c.scrapeIntervalHours));
                          if (v) run(updateClub(c.id, { scrapeIntervalHours: Number(v) }));
                        }}
                      >
                        Change interval
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          const v = window.prompt("Display name", c.name);
                          if (v) run(updateClub(c.id, { name: v }));
                        }}
                      >
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => {
                          if (window.confirm(`${c.optOut ? "Undo opt-out for" : "Opt out"} ${c.name}? Opting out hides all their events.`))
                            run(updateClub(c.id, { optOut: !c.optOut, active: c.optOut }));
                        }}
                      >
                        {c.optOut ? "Undo opt-out" : "Club asked to be removed (opt out)"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          if (window.confirm(`Delete ${c.name}? Their existing events stay until you hide them.`)) run(deleteClub(c.id));
                        }}
                      >
                        Delete club
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
