import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RunView } from "@/lib/server/admin-data";

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "–";

export function RunsTable({ runs }: { runs: RunView[] }) {
  if (!runs.length) {
    return <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No runs yet. Add clubs, then click “Scrape all now”.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Clubs</TableHead>
            <TableHead className="text-right">New posts</TableHead>
            <TableHead className="text-right">Processed</TableHead>
            <TableHead className="text-right">Events (+merged)</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Errors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">
                {fmt(r.startedAt)} <span className="text-xs text-muted-foreground">({r.trigger})</span>
              </TableCell>
              <TableCell>
                <Badge variant={r.status === "failed" ? "destructive" : r.status === "done" ? "secondary" : "outline"}>{r.status}</Badge>
              </TableCell>
              <TableCell className="max-w-48 truncate text-xs" title={r.handles.join(", ")}>
                {r.handles.length} · {r.handles.slice(0, 3).join(", ")}
                {r.handles.length > 3 ? "…" : ""}
              </TableCell>
              <TableCell className="text-right font-mono">{r.postsNew}</TableCell>
              <TableCell className="text-right font-mono">{r.postsProcessed}</TableCell>
              <TableCell className="text-right font-mono">
                {r.eventsCreated} <span className="text-muted-foreground">+{r.eventsMerged}</span>
              </TableCell>
              <TableCell className="text-right font-mono">${r.cost.toFixed(3)}</TableCell>
              <TableCell className="max-w-64 truncate text-xs text-danger" title={r.errors.join("\n")}>
                {r.errors.length ? `${r.errors.length}: ${r.errors[0]}` : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
