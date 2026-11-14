import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wordmark: serif "clubo" with a gold dot. Our own mark, not Cal branding. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Clubo home"
      className={cn("font-display text-[1.75rem] leading-none tracking-tight text-foreground", className)}
    >
      clubo<span className="text-gold">.</span>
    </Link>
  );
}
