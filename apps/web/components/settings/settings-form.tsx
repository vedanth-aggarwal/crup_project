"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CATEGORIES, CATEGORY_META } from "@clubo/shared";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateNotificationPrefs } from "@/app/actions";
import { useUserState } from "@/components/auth/user-state";
import { ClubAvatar } from "@/components/clubs/club-avatar";
import { cn } from "@/lib/utils";
import type { UserView } from "@/lib/types";

type Prefs = UserView["notificationPrefs"];

export function SettingsForm({ prefs: initial, clubs }: { prefs: Prefs; clubs: { id: string; name: string; avatarUrl: string | null }[] }) {
  const [prefs, setPrefs] = useState(initial);
  const [, start] = useTransition();
  const { categories, setFollowCategory, clubs: followed, setFollowClub } = useUserState();

  const save = (next: Prefs) => {
    const prev = prefs;
    setPrefs(next);
    start(async () => {
      const r = await updateNotificationPrefs(next);
      if (!r.ok) {
        setPrefs(prev);
        toast.error(r.error);
      } else toast.success("Saved");
    });
  };

  const rows: { key: keyof Omit<Prefs, "reminderLeadHours">; title: string; preview: string }[] = [
    {
      key: "reminders",
      title: "Event reminders",
      preview: `You'll get an email ${prefs.reminderLeadHours === 1 ? "1 hour" : `${prefs.reminderLeadHours} hours`} before saved events start.`,
    },
    { key: "deadlines", title: "Deadline alerts", preview: "3 days and 1 day before saved deadlines and ones from clubs you follow." },
    { key: "newFromFollowed", title: "New from clubs you follow", preview: "At most one email a day when they post something new." },
    { key: "weeklyDigest", title: "Weekly digest", preview: "Sunday evening: your week ahead at Berkeley." },
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-4" aria-labelledby="notif-h">
        <h2 id="notif-h" className="font-display text-3xl">Email</h2>
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((r) => (
            <div key={r.key} className="flex items-start justify-between gap-6 p-4">
              <div>
                <Label htmlFor={r.key} className="text-base font-medium">{r.title}</Label>
                <p className={cn("mt-0.5 text-sm text-muted-foreground", !prefs[r.key] && "opacity-60")}>{r.preview}</p>
                {r.key === "reminders" && prefs.reminders && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Remind me</span>
                    <Select value={String(prefs.reminderLeadHours)} onValueChange={(v) => save({ ...prefs, reminderLeadHours: Number(v) })}>
                      <SelectTrigger className="h-8 w-36" aria-label="Reminder timing"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour before</SelectItem>
                        <SelectItem value="3">3 hours before</SelectItem>
                        <SelectItem value="24">1 day before</SelectItem>
                        <SelectItem value="48">2 days before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Switch id={r.key} checked={prefs[r.key]} onCheckedChange={(v) => save({ ...prefs, [r.key]: v })} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="cat-h">
        <div>
          <h2 id="cat-h" className="font-display text-3xl">Categories you follow</h2>
          <p className="text-sm text-muted-foreground">Used for &ldquo;From what I follow&rdquo; and new-event emails.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = categories.has(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setFollowCategory(c, !on)}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                  on ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-accent",
                )}
              >
                <span aria-hidden>{CATEGORY_META[c].emoji}</span> {c}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="clubs-h">
        <h2 id="clubs-h" className="font-display text-3xl">Clubs you follow</h2>
        {clubs.filter((c) => followed.has(c.id)).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet. <Link href="/clubs" className="font-medium text-foreground underline underline-offset-2">Browse clubs</Link>
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {clubs.filter((c) => followed.has(c.id)).map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <ClubAvatar name={c.name} src={c.avatarUrl} size={32} />
                <Link href={`/clubs/${c.id}`} className="flex-1 font-medium hover:underline">{c.name}</Link>
                <button type="button" onClick={() => setFollowClub(c.id, false, c.name)} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                  Unfollow
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
