"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export type ClientUser = { uid: string; email: string | null; name: string | null; admin: boolean };

type AuthCtx = {
  user: ClientUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

async function establishSession(u: User): Promise<ClientUser> {
  const post = async (force: boolean) => {
    const idToken = await u.getIdToken(force);
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const body = (await res.json()) as { ok?: boolean; refresh?: boolean; admin?: boolean; error?: string };
    if (!res.ok) throw new Error(body.error ?? "Could not sign in");
    return body;
  };
  let body = await post(false);
  if (body.refresh) body = await post(true); // admin claim was just granted
  return { uid: u.uid, email: u.email, name: u.displayName, admin: body.admin === true };
}

/**
 * The server session cookie is the source of truth (initialUser comes from it).
 * Firebase client auth is only used to sign in, then handed off to the cookie.
 */
export function AuthProvider({ initialUser, children }: { initialUser: ClientUser | null; children: React.ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(initialUser);
  const router = useRouter();

  const finish = useCallback(
    async (u: User) => {
      setUser(await establishSession(u));
      router.refresh();
    },
    [router],
  );

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      signIn: async (email, password) => finish((await signInWithEmailAndPassword(auth, email, password)).user),
      signUp: async (name, email, password) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        await finish(cred.user);
      },
      signInWithGoogle: async () => finish((await signInWithPopup(auth, new GoogleAuthProvider())).user),
      resetPassword: (email) => sendPasswordResetEmail(auth, email),
      signOut: async () => {
        await fetch("/api/auth/session", { method: "DELETE" });
        await fbSignOut(auth).catch(() => {});
        setUser(null);
        router.refresh();
      },
    }),
    [user, finish, router],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}

/** Friendly copy for Firebase auth error codes. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "That email and password don't match.",
    "auth/user-not-found": "No account with that email.",
    "auth/wrong-password": "That email and password don't match.",
    "auth/email-already-in-use": "There's already an account with that email. Try signing in.",
    "auth/weak-password": "Pick a stronger password (at least 8 characters).",
    "auth/invalid-email": "That doesn't look like an email address.",
    "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] ?? (e instanceof Error ? e.message : "Something went wrong.");
}
