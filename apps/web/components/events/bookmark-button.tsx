"use client";

import { Heart } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useUserState } from "@/components/auth/user-state";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  eventId,
  title,
  className,
  variant = "overlay",
}: {
  eventId: string;
  title: string;
  className?: string;
  variant?: "overlay" | "inline";
}) {
  const { bookmarks, setBookmark } = useUserState();
  const on = bookmarks.has(eventId);
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from saved` : `Save ${title}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setBookmark(eventId, !on, title);
      }}
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-full transition-colors duration-150",
        variant === "overlay"
          ? "bg-card/90 text-foreground shadow-sm backdrop-blur hover:bg-card"
          : "border bg-card hover:bg-accent",
        className,
      )}
    >
      <motion.span
        key={on ? "on" : "off"}
        initial={reduce ? false : { scale: on ? 0.6 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        className="inline-flex"
      >
        <Heart className={cn("size-5", on && "fill-danger text-danger")} aria-hidden />
      </motion.span>
      <AnimatePresence>
        {on && !reduce && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-danger"
          />
        )}
      </AnimatePresence>
    </button>
  );
}
