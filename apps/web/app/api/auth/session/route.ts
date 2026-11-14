import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_NOTIFICATION_PREFS } from "@clubo/shared";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { env } from "@/lib/server/env";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/server/session";

/**
 * Exchange a fresh Firebase ID token for an httpOnly session cookie.
 * Also creates the users/{uid} doc on first sign-in and grants the admin
 * claim to emails in ADMIN_EMAILS.
 */
export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });

  const auth = adminAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  // Only mint session cookies from recent sign-ins.
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
    return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  }

  const email = decoded.email?.toLowerCase() ?? null;
  let refreshed = false;
  if (email && env.adminEmails.includes(email) && decoded.admin !== true) {
    await auth.setCustomUserClaims(decoded.uid, { admin: true });
    refreshed = true; // client must fetch a new ID token to carry the claim
  }

  const userRef = adminDb().collection("users").doc(decoded.uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      email,
      name: (decoded.name as string | undefined) ?? null,
      followedClubs: [],
      followedCategories: [],
      notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  if (refreshed) return NextResponse.json({ refresh: true });

  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  const res = NextResponse.json({ ok: true, admin: decoded.admin === true });
  res.cookies.set(SESSION_COOKIE, sessionCookie, {
    maxAge: SESSION_MAX_AGE_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
