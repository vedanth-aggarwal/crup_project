"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, ClipboardCheck, Gauge, Image as ImageIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/review", label: "Review queue", icon: ClipboardCheck },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/clubs", label: "Clubs", icon: Users },
  { href: "/admin/posts", label: "Raw posts", icon: ImageIcon },
  { href: "/admin/runs", label: "Scrape runs", icon: Activity },
];

export function AdminNav() {
  const p = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? p === "/admin" : p.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            <i.icon className="size-4" aria-hidden /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
