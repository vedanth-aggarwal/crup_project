import { assertAdminPage } from "@/lib/server/session";
import { getPosts, recentEvents, reviewQueue } from "@/lib/server/admin-data";
import { ReviewQueue } from "@/components/admin/review-queue";

export default async function ReviewPage() {
  await assertAdminPage();
  const events = await reviewQueue();
  const clubIds = new Set(events.map((e) => e.clubId));
  const [posts, recent] = await Promise.all([
    getPosts([...new Set(events.flatMap((e) => e.sourcePostIds.slice(0, 1)))]),
    recentEvents(),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"} the model wasn&rsquo;t sure about. Fields it guessed are highlighted.
        </p>
      </header>
      <ReviewQueue
        events={events}
        posts={Object.fromEntries(posts.map((p) => [p.id, p]))}
        mergeCandidates={recent.filter((e) => clubIds.has(e.clubId))}
      />
    </div>
  );
}
