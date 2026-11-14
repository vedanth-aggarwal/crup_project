import { assertAdminPage } from "@/lib/server/session";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { recentPosts } from "@/lib/server/admin-data";
import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { formatWhen } from "@/lib/dates";
import { reextractPost } from "../actions";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "pending", "extracted", "needs_review", "no_event", "failed"] as const;

export default async function PostsPage({ searchParams }: PageProps<"/admin/posts">) {
  await assertAdminPage();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (STATUSES as readonly string[]).includes(sp.status) && sp.status !== "all" ? sp.status : undefined;
  const posts = await recentPosts(status);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl">Raw posts</h1>
        <p className="text-sm text-muted-foreground">What the scraper returned, and what extraction made of it.</p>
      </header>
      <nav className="flex flex-wrap gap-1" aria-label="Filter by status">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/admin/posts" : `/admin/posts?status=${s}`}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              (status ?? "all") === s ? "bg-foreground text-background" : "bg-card hover:bg-accent",
            )}
          >
            {s.replace("_", " ")}
          </Link>
        ))}
      </nav>
      {posts.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No posts here.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
              {p.imagePaths[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagePaths[0]} alt="" className="aspect-[4/3] w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col gap-2 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">@{p.handle}</span>
                  <Badge variant={p.status === "failed" ? "destructive" : p.status === "extracted" ? "secondary" : "outline"}>
                    {p.status.replace("_", " ")}
                    {p.confidence !== null && ` · ${Math.round(p.confidence * 100)}%`}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.postedAt ? formatWhen(p.postedAt, null, false) : ""} · {p.type}
                </p>
                <p className="line-clamp-4 whitespace-pre-wrap text-xs">{p.caption}</p>
                {p.error && <p className="rounded bg-danger/10 px-2 py-1 text-xs text-danger">{p.error}</p>}
                {p.raw != null && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Model output ({p.model})</summary>
                    <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 font-mono text-[10px]">{JSON.stringify(p.raw, null, 2)}</pre>
                  </details>
                )}
                <div className="mt-auto flex items-center justify-between pt-1">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Instagram <ArrowUpRight className="size-3" aria-hidden />
                  </a>
                  <ActionButton size="sm" variant="outline" action={reextractPost.bind(null, p.id)}>
                    Re-run extraction
                  </ActionButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
