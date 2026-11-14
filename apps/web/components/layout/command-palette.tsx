"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Heart, Sparkles, Users, CalendarClock, Settings } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { formatWhen } from "@/lib/dates";

type Hit = {
  events: { id: string; title: string; clubName: string; startAt: string | null; endAt: string | null; allDay: boolean }[];
  clubs: { id: string; name: string; igHandle: string }[];
};

const Ctx = createContext<{ open: () => void } | null>(null);
export const useCommandPalette = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCommandPalette outside provider");
  return v;
};

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit>({ events: [], clubs: [] });
  const router = useRouter();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal });
        if (res.ok) setHits(await res.json());
      } catch {
        /* aborted */
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q, open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQ("");
      router.push(href);
    },
    [router],
  );

  const value = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <Ctx.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title="Search Clubo" description="Search events, clubs and pages">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search events, clubs, or ask a question…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>No matches. Try asking Clubo instead.</CommandEmpty>
            {q.trim().length > 2 && (
              <CommandGroup heading="Ask">
                <CommandItem value={`ask-${q}`} onSelect={() => go(`/chat?q=${encodeURIComponent(q)}`)}>
                  <Sparkles className="text-gold" />
                  Ask Clubo: “{q}”
                </CommandItem>
              </CommandGroup>
            )}
            {hits.events.length > 0 && (
              <CommandGroup heading="Events">
                {hits.events.map((e) => (
                  <CommandItem key={e.id} value={`event-${e.id}`} onSelect={() => go(`/events/${e.id}`)}>
                    <CalendarDays />
                    <div className="min-w-0">
                      <div className="truncate">{e.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {e.clubName} · {formatWhen(e.startAt, e.endAt, e.allDay)}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {hits.clubs.length > 0 && (
              <CommandGroup heading="Clubs">
                {hits.clubs.map((c) => (
                  <CommandItem key={c.id} value={`club-${c.id}`} onSelect={() => go(`/clubs/${c.id}`)}>
                    <Users />
                    {c.name}
                    <span className="ml-auto text-xs text-muted-foreground">@{c.igHandle}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {[
                { href: "/", label: "Feed", icon: CalendarDays },
                { href: "/deadlines", label: "Deadlines", icon: CalendarClock },
                { href: "/saved", label: "Saved", icon: Heart },
                { href: "/clubs", label: "Clubs", icon: Users },
                { href: "/chat", label: "Ask Clubo", icon: Sparkles },
                { href: "/settings", label: "Settings", icon: Settings },
              ].map((p) => (
                <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                  <p.icon />
                  {p.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </Ctx.Provider>
  );
}
