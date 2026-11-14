import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings/settings-form";
import { getSessionUser } from "@/lib/server/session";
import { getUserView, listClubs } from "@/lib/server/data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/settings");
  const [view, clubs] = await Promise.all([getUserView(user.uid), listClubs()]);
  if (!view) redirect("/login?next=/settings");
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-5xl">Settings</h1>
        <p className="text-muted-foreground">Signed in as {user.email}</p>
      </header>
      <SettingsForm prefs={view.notificationPrefs} clubs={clubs.map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl }))} />
    </div>
  );
}
