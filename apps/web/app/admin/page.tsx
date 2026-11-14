import { assertAdminPage } from "@/lib/server/session";
import Link from "next/link";
import { dashboardStats, recentRuns } from "@/lib/server/admin-data";
import { DailyBars } from "@/components/admin/daily-bars";
import { ActionButton } from "@/components/admin/action-button";
import { RunsTable } from "@/components/admin/runs-table";
import { processPendingNow, scrapeNow, sendTestEmail } from "./actions";

export default async function AdminHome() {
  await assertAdminPage();
  const [s, runs] = await Promise.all([dashboardStats(), recentRuns(8)]);
  const tiles: { label: string; value: string | number; href?: string; tone?: string }[] = [
    { label: "Review backlog", value: s.review ?? "–", href: "/admin/review", tone: (s.review ?? 0) > 0 ? "text-warning" : "" },
    { label: "Upcoming published events", value: s.published ?? "–", href: "/admin/events" },
    { label: "Active clubs", value: `${s.activeClubs ?? "–"} / ${s.clubs ?? "–"}`, href: "/admin/clubs" },
    { label: "Posts waiting for extraction", value: s.pending ?? "–", href: "/admin/posts?status=pending" },
    { label: "Failed posts", value: s.failed ?? "–", href: "/admin/posts?status=failed", tone: (s.failed ?? 0) > 0 ? "text-danger" : "" },
    { label: "Users", value: s.users ?? "–" },
    { label: "Extraction success (7d)", value: s.successRate === null ? "–" : `${Math.round(s.successRate * 100)}%` },
    { label: "Est. cost (14d)", value: `$${s.cost14.toFixed(2)}` },
  ];
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Scraping runs daily on Vercel Cron. Use these buttons to run it now.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton variant="ghost" action={sendTestEmail}>
            Send test email
          </ActionButton>
          <ActionButton variant="outline" action={processPendingNow}>
            Process pending posts
          </ActionButton>
          <ActionButton action={() => scrapeNow()} confirm="Scrape every active club now? This uses Apify credits.">
            Scrape all now
          </ActionButton>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd className={`mt-1 font-mono text-2xl font-semibold ${t.tone ?? ""}`}>{t.value}</dd>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href as "/admin"} className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent">
              {body}
            </Link>
          ) : (
            <div key={t.label} className="rounded-lg border bg-card p-4">
              {body}
            </div>
          );
        })}
      </dl>
      <div className="grid gap-4 lg:grid-cols-3">
        <DailyBars title="New posts scraped per day" data={s.days.map((d) => ({ day: d.day, value: d.posts }))} />
        <DailyBars title="Events created per day" data={s.days.map((d) => ({ day: d.day, value: d.events }))} />
        <DailyBars title="Estimated cost per day" data={s.days.map((d) => ({ day: d.day, value: d.cost }))} currency />
      </div>
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Recent runs</h2>
          <Link href="/admin/runs" className="text-sm text-muted-foreground hover:text-foreground">
            All runs →
          </Link>
        </div>
        <RunsTable runs={runs} />
      </section>
    </div>
  );
}
