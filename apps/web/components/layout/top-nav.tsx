"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "./theme-toggle";
import { AccountMenu } from "./account-menu";
import { NAV, isActive } from "./nav-items";
import { useCommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";

export function TopNav() {
  const pathname = usePathname();
  const palette = useCommandPalette();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                isActive(pathname, n.href) && "bg-accent text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={palette.open}
            className="hidden h-10 w-56 items-center gap-2 rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:bg-accent sm:flex lg:w-72"
          >
            <Search className="size-4" aria-hidden />
            <span>Search events, clubs…</span>
            <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={palette.open}
            aria-label="Search"
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-accent sm:hidden"
          >
            <Search className="size-5" aria-hidden />
          </button>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
