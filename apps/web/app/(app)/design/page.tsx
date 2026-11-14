import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heart } from "lucide-react";
import { CATEGORIES } from "@clubo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CategoryChip, TagChip } from "@/components/events/chips";
import { DateBadge } from "@/components/events/date-badge";
import { EventGrid, EventGridSkeleton } from "@/components/events/event-grid";
import { DeadlineList } from "@/components/events/deadline-list";
import { EmptyState } from "@/components/brand/empty-state";
import { Logo } from "@/components/brand/logo";
import { ClubAvatar } from "@/components/clubs/club-avatar";
import { getSessionUser } from "@/lib/server/session";
import type { EventView } from "@/lib/types";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

const SWATCHES = [
  ["background", "bg-background"], ["card", "bg-card"], ["muted", "bg-muted"], ["border", "bg-border"],
  ["foreground", "bg-foreground"], ["muted-foreground", "bg-muted-foreground"], ["brand", "bg-brand"], ["gold", "bg-gold"],
  ["success", "bg-success"], ["warning", "bg-warning"], ["danger", "bg-danger"], ["info", "bg-info"],
] as const;

const h = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();
const sample = (over: Partial<EventView>): EventView => ({
  id: "sample", clubId: "c", clubName: "Cal Hacks", sourcePostIds: [], title: "Hack Night: build something weird",
  summary: "Bring a laptop. Pizza at 8.", description: "",
  details: { highlights: [], partners: [], speakers: [], audience: null, agenda: [], perks: [], requirements: [], rsvpRequired: null },
  kind: "event", startAt: h(26), endAt: h(29), allDay: false,
  deadlineAt: null, sortAt: h(26), recurrence: null,
  location: { name: "Soda Hall 306", address: null, isOnline: false, campusBuilding: "Soda" },
  categories: ["Tech"], tags: ["hackathon"], cost: { isFree: true, price: null }, freeFood: true,
  links: { rsvp: null, tickets: null, application: null, info: [] }, posterPath: null, imagePaths: [], poster: null,
  confidence: 0.9, uncertainFields: [], status: "published", bookmarkCount: 0, createdAt: h(0), updatedAt: h(0),
  ...over,
});

export default async function DesignPage() {
  if (process.env.NODE_ENV === "production" && !(await getSessionUser())?.admin) notFound();
  const cards = [
    sample({ id: "s1" }),
    sample({ id: "s2", title: "Diwali Night Market", clubName: "Indian Student Association", categories: ["Cultural", "Food"], startAt: h(-0.5), endAt: h(2), sortAt: h(-0.5), tags: ["music"] }),
    sample({ id: "s3", title: "Consulting Club Fall Recruitment", clubName: "Berkeley Consulting", kind: "deadline", deadlineAt: h(40), startAt: null, sortAt: h(40), categories: ["Recruiting/Applications"], freeFood: false, cost: { isFree: null, price: null }, links: { rsvp: null, tickets: null, application: "https://example.com", info: [] } }),
    sample({ id: "s4", title: "Sunset Yoga on Memorial Glade", clubName: "Cal Wellness", categories: ["Wellness"], freeFood: false, startAt: h(3), sortAt: h(3), endAt: h(4) }),
  ];
  return (
    <div className="space-y-14">
      <header className="space-y-2">
        <Logo />
        <h1 className="font-display text-5xl">Design system</h1>
        <p className="max-w-xl text-muted-foreground">Every token and component in every state. Toggle the theme to check dark mode. Components use these tokens only, never raw colours.</p>
      </header>

      <Section title="Colour">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="overflow-hidden rounded-md border">
              <div className={`h-16 ${cls}`} />
              <p className="px-2 py-1.5 font-mono text-xs">--{name}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-4">
          {CATEGORIES.map((c) => <CategoryChip key={c} category={c} withEmoji />)}
        </div>
      </Section>

      <Section title="Type">
        <p className="font-display text-6xl leading-none">What&rsquo;s happening</p>
        <p className="font-display text-4xl">Display / Instrument Serif</p>
        <p className="text-2xl font-semibold">UI heading / Geist Sans 24</p>
        <p className="text-base">Body / Geist Sans 16. Posters are the content, so the interface stays calm.</p>
        <p className="text-sm text-muted-foreground">Muted / 14</p>
        <p className="font-mono text-sm">Fri, Nov 14 · 7–9 PM / Geist Mono</p>
      </Section>

      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-3">
          <Button className="rounded-full">Primary</Button>
          <Button variant="outline" className="rounded-full">Outline</Button>
          <Button variant="secondary" className="rounded-full">Secondary</Button>
          <Button variant="ghost" className="rounded-full">Ghost</Button>
          <Button variant="destructive" className="rounded-full">Destructive</Button>
          <Button disabled className="rounded-full">Disabled</Button>
          <Button size="icon" variant="outline" aria-label="Icon button"><Heart /></Button>
          <Switch defaultChecked aria-label="Example switch" />
          <Input placeholder="Text input" className="w-56" />
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <TagChip>🍕 Free food</TagChip><TagChip>Free</TagChip><TagChip>networking</TagChip>
          <DateBadge iso={h(26)} />
          <ClubAvatar name="Cal Hacks" size={32} /><ClubAvatar name="Women in Tech" size={48} />
        </div>
      </Section>

      <Section title="Event cards: default, live, deadline, today">
        <EventGrid events={cards} />
      </Section>

      <Section title="Deadline list">
        <DeadlineList events={[cards[2]!, sample({ id: "s5", kind: "deadline", title: "Hackathon RSVP", deadlineAt: h(5), sortAt: h(5), startAt: null, links: { rsvp: "https://example.com", tickets: null, application: null, info: [] } })]} />
      </Section>

      <Section title="Loading">
        <EventGridSkeleton count={4} />
      </Section>

      <Section title="Empty & error">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border"><EmptyState title="No events match" description="Try a different date or fewer categories." action={<Button variant="outline" className="rounded-full">Clear filters</Button>} /></div>
          <div className="rounded-lg border"><EmptyState tone="error" title="Couldn't load this page" description="Something went wrong on our end." action={<Button className="rounded-full">Try again</Button>} /></div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
