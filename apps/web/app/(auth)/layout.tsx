import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { listUpcomingEvents } from "@/lib/server/data";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const posters = (await listUpcomingEvents().catch(() => [])).filter((e) => e.poster).slice(0, 9);
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-brand lg:block" aria-hidden>
        <div className="absolute inset-0 grid -rotate-6 scale-125 grid-cols-3 gap-4 p-8 opacity-90">
          {(posters.length ? posters : Array.from({ length: 9 })).map((e, i) => {
            const p = (e as (typeof posters)[number] | undefined)?.poster;
            return (
              <div
                key={i}
                className="aspect-[4/5] overflow-hidden rounded-lg shadow-lg"
                style={{ backgroundColor: p?.dominantColor ?? `oklch(${0.35 + (i % 3) * 0.08} 0.08 ${[255, 85, 330][i % 3]})`, transform: `translateY(${(i % 3) * 28}px)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p && <img src={p.sizes.md} alt="" className="size-full object-cover" />}
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand via-brand/80 to-transparent p-10 pt-32 text-brand-foreground">
          <p className="font-display text-4xl leading-tight">Every club event at Berkeley, on one board.</p>
          <p className="mt-2 text-sm opacity-80">Save events, follow clubs, and get reminders before things start.</p>
        </div>
      </aside>
    </div>
  );
}
