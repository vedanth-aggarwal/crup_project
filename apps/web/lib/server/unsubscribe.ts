import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, requireEnv } from "./env";

export const UNSUB_TYPES = ["reminders", "deadlines", "newFromFollowed", "weeklyDigest", "all"] as const;
export type UnsubType = (typeof UNSUB_TYPES)[number];

const sign = (uid: string, type: string) =>
  createHmac("sha256", requireEnv("UNSUBSCRIBE_SECRET")).update(`${uid}:${type}`).digest("base64url");

export function unsubscribeUrl(uid: string, type: UnsubType) {
  const p = new URLSearchParams({ u: uid, t: type, s: sign(uid, type) });
  return `${env.appUrl}/api/unsubscribe?${p}`;
}

export function verifyUnsubscribe(uid: string, type: string, sig: string) {
  if (!(UNSUB_TYPES as readonly string[]).includes(type)) return false;
  const want = Buffer.from(sign(uid, type));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
