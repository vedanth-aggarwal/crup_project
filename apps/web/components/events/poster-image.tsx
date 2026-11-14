"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventView } from "@/lib/types";

/**
 * Poster at Instagram's 4:5 ratio. Reserves space up front (no layout shift),
 * shows the poster's main color + blurred preview while loading.
 */
export function PosterImage({
  event,
  sizes = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw",
  priority,
  className,
  imgClassName,
}: {
  event: Pick<EventView, "poster" | "title" | "categories">;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const p = event.poster;
  return (
    <div
      className={cn("relative aspect-[4/5] overflow-hidden bg-muted", className)}
      style={p?.dominantColor ? { backgroundColor: p.dominantColor } : undefined}
    >
      {p && !failed ? (
        <Image
          src={p.sizes.lg}
          alt={p.altText || `Poster for ${event.title}`}
          fill
          sizes={sizes}
          priority={priority}
          placeholder={p.blurDataUrl ? "blur" : "empty"}
          blurDataURL={p.blurDataUrl || undefined}
          onError={() => setFailed(true)}
          className={cn("object-cover", imgClassName)}
        />
      ) : (
        <PosterFallback title={event.title} />
      )}
    </div>
  );
}

function PosterFallback({ title }: { title: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-brand/90 to-brand p-6 text-center text-brand-foreground">
      <ImageOff className="size-6 opacity-50" aria-hidden />
      <p className="font-display text-2xl leading-tight">{title}</p>
    </div>
  );
}
