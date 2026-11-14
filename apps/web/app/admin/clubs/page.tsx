import { assertAdminPage } from "@/lib/server/session";
import { adminClubs } from "@/lib/server/admin-data";
import { AddClubDialog, ImportCsvDialog } from "@/components/admin/club-forms";
import { ClubsTable } from "@/components/admin/clubs-table";

export default async function AdminClubsPage() {
  await assertAdminPage();
  const clubs = await adminClubs();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Clubs</h1>
          <p className="text-sm text-muted-foreground">Active clubs are scraped on their interval. Private or renamed accounts are flagged.</p>
        </div>
        <div className="flex gap-2">
          <ImportCsvDialog />
          <AddClubDialog />
        </div>
      </header>
      <ClubsTable clubs={clubs} />
    </div>
  );
}
