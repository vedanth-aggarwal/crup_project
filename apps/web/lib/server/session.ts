import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { adminAuth } from "./firebase-admin";
import { hasAdminCredentials } from "./env";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days (Firebase max)

export type SessionUser = { uid: string; email: string | null; name: string | null; admin: boolean };

/** The signed-in user for this request, or null. Never throws. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Read cookies first so pages using this are always rendered per request.
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (!cookie || !hasAdminCredentials()) return null;
  try {
    const t = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: t.uid,
      email: t.email ?? null,
      name: (t.name as string | undefined) ?? null,
      admin: t.admin === true,
    };
  } catch {
    return null;
  }
});

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AuthError(401, "Sign in to do that.");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (!u.admin) throw new AuthError(403, "Admins only.");
  return u;
}

/** For admin pages: 404 for everyone else. Pages render in parallel with layouts, so each page must call this itself. */
export async function assertAdminPage(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u?.admin) notFound();
  return u;
}
