import "server-only";
import OpenAI from "openai";
import { requireEnv } from "./env";

let client: OpenAI | undefined;
export const openai = () => (client ??= new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") }));

/** USD per 1M tokens, for rough cost estimates in admin. Unknown models fall back to mini pricing. */
const PRICES: Record<string, { in: number; out: number }> = {
  "gpt-5.4-mini": { in: 0.75, out: 4.5 },
  "gpt-5.4-nano": { in: 0.2, out: 1.25 },
  "gpt-5-mini": { in: 0.25, out: 2 },
  "gpt-5.4": { in: 2.5, out: 15 },
  "text-embedding-3-small": { in: 0.02, out: 0 },
};
export function estimateCost(model: string, usage?: { input_tokens?: number; output_tokens?: number } | null) {
  const p = PRICES[model] ?? PRICES["gpt-5.4-mini"]!;
  return ((usage?.input_tokens ?? 0) * p.in + (usage?.output_tokens ?? 0) * p.out) / 1_000_000;
}
