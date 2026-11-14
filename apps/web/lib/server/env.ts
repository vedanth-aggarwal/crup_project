import "server-only";
import { appUrl } from "@/lib/app-url";

/** Read a required server env var, with a clear error instead of an undefined crash. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Add it to .env and to Vercel.`);
  return v;
}

export const env = {
  get extractionModel() { return process.env.EXTRACTION_MODEL || "gpt-5.4-mini"; },
  get chatModel() { return process.env.CHAT_MODEL || "gpt-5.4-mini"; },
  get embeddingModel() { return process.env.EMBEDDING_MODEL || "text-embedding-3-small"; },
  get embeddingDimensions() { return Number(process.env.EMBEDDING_DIMENSIONS || 1536); },
  get chatDailyLimit() { return Number(process.env.CHAT_DAILY_LIMIT || 30); },
  get appUrl() { return appUrl(); },
  get adminEmails() {
    return (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  },
};

/** True once a real service-account key is configured (not the .env.example placeholder). */
export function hasAdminCredentials(): boolean {
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY;
  return Boolean(email && key && key.includes("BEGIN PRIVATE KEY") && key.length > 200);
}
