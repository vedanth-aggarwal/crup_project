import { assertAdminPage } from "@/lib/server/session";
import { recentRuns } from "@/lib/server/admin-data";
import { RunsTable } from "@/components/admin/runs-table";

export default async function RunsPage() {
  await assertAdminPage();
  const runs = await recentRuns(100);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Scrape runs</h1>
      <RunsTable runs={runs} />
    </div>
  );
}
