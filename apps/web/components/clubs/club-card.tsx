import Link from "next/link";
import { ClubAvatar } from "./club-avatar";
import { FollowButton } from "./follow-button";
import { CategoryChip } from "@/components/events/chips";
import type { ClubView } from "@/lib/types";

export function ClubCard({ club }: { club: ClubView }) {
  return (
    <article className="group relative flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <ClubAvatar name={club.name} src={club.avatarUrl} size={48} />
        <div className="min-w-0 flex-1">
          <Link href={`/clubs/${club.id}`} className="font-semibold leading-tight after:absolute after:inset-0 hover:underline">
            {club.name}
          </Link>
          <p className="text-xs text-muted-foreground">@{club.igHandle}</p>
        </div>
      </div>
      {club.description && <p className="line-clamp-2 text-sm text-muted-foreground">{club.description}</p>}
      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {club.category.slice(0, 2).map((c) => (
            <CategoryChip key={c} category={c} />
          ))}
        </div>
        <div className="relative z-10 shrink-0">
          <FollowButton clubId={club.id} clubName={club.name} size="sm" />
        </div>
      </div>
      {!!club.upcomingCount && (
        <p className="text-xs font-medium text-brand">{club.upcomingCount} upcoming event{club.upcomingCount === 1 ? "" : "s"}</p>
      )}
    </article>
  );
}
