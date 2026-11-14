import { CalendarClock, Heart, LayoutGrid, Sparkles, Users } from "lucide-react";

export const NAV = [
  { href: "/", label: "Feed", icon: LayoutGrid },
  { href: "/deadlines", label: "Deadlines", icon: CalendarClock },
  { href: "/chat", label: "Ask Clubo", short: "Ask", icon: Sparkles },
  { href: "/clubs", label: "Clubs", icon: Users },
  { href: "/saved", label: "Saved", icon: Heart },
] as const;

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
