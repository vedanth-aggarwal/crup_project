import "server-only";
import { openai } from "./openai";
import { env } from "./env";

/** Text that represents an event for vector search (PLAN.md §3). */
export function embeddingText(e: {
  title: string;
  summary?: string | null;
  clubName: string;
  tags?: string[];
  categories?: string[];
  location?: { name?: string | null } | null;
  details?: { partners?: string[]; highlights?: string[]; speakers?: { name: string; role: string | null }[] } | null;
}) {
  return [
    e.title,
    e.summary,
    `Hosted by ${e.clubName}`,
    e.details?.partners?.length ? `With ${e.details.partners.join(", ")}` : null,
    e.details?.speakers?.map((s) => [s.name, s.role].filter(Boolean).join(", ")).join("; "),
    e.details?.highlights?.join(". "),
    e.categories?.join(", "),
    e.tags?.join(", "),
    e.location?.name,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await openai().embeddings.create({
    model: env.embeddingModel,
    input: texts.map((t) => t.slice(0, 8000)),
    dimensions: env.embeddingDimensions,
  });
  return res.data.map((d) => d.embedding);
}
