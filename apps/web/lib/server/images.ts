import "server-only";
import sharp from "sharp";
import { put } from "@vercel/blob";

export const POSTER_WIDTHS = { sm: 320, md: 640, lg: 1080 } as const;

export type ProcessedImage = {
  sizes: { sm: string; md: string; lg: string };
  width: number;
  height: number;
  blurDataUrl: string;
  dominantColor: string;
};

const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/**
 * Copy an Instagram image into Vercel Blob (IG CDN URLs expire within days),
 * as resized WebP versions plus a tiny blurred placeholder and main colour.
 */
export async function processImage(sourceUrl: string, keyPrefix: string): Promise<ProcessedImage> {
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  const base = sharp(input, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 1080;
  const height = meta.height ?? 1350;

  const uploads = await Promise.all(
    (Object.entries(POSTER_WIDTHS) as [keyof typeof POSTER_WIDTHS, number][]).map(async ([k, w]) => {
      const buf = await base.clone().resize({ width: Math.min(w, width), withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      const blob = await put(`${keyPrefix}-${w}.webp`, buf, {
        access: "public",
        contentType: "image/webp",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      });
      return [k, blob.url] as const;
    }),
  );

  const [tiny, stats] = await Promise.all([
    base.clone().resize(16, 20, { fit: "cover" }).blur(1.2).webp({ quality: 40 }).toBuffer(),
    base.clone().stats(),
  ]);
  const d = stats.dominant;
  return {
    sizes: Object.fromEntries(uploads) as ProcessedImage["sizes"],
    width,
    height,
    blurDataUrl: `data:image/webp;base64,${tiny.toString("base64")}`,
    dominantColor: `#${toHex(d.r)}${toHex(d.g)}${toHex(d.b)}`,
  };
}

/** Pick up to `max` image URLs from a scraped post (carousels send several). */
export function imageSources(p: { displayUrl?: string; images?: string[]; childPosts?: { displayUrl?: string; type?: string }[] }, max = 4) {
  const urls = [
    ...(p.childPosts ?? []).filter((c) => c.type !== "Video").map((c) => c.displayUrl),
    ...(p.images ?? []),
    p.displayUrl,
  ].filter((u): u is string => !!u);
  return [...new Set(urls)].slice(0, max);
}
