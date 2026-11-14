"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Category } from "@clubo/shared";
import { toggleBookmark, toggleFollowCategory, toggleFollowClub, type ActionResult } from "@/app/actions";

type State = { bookmarks: Set<string>; clubs: Set<string>; categories: Set<Category>; signedIn: boolean };
type Ctx = State & {
  setBookmark: (id: string, on: boolean, label?: string) => void;
  setFollowClub: (id: string, on: boolean, label?: string) => void;
  setFollowCategory: (c: Category, on: boolean) => void;
  pending: boolean;
};

const UserStateCtx = createContext<Ctx | null>(null);

export function UserStateProvider({
  initial,
  children,
}: {
  initial: { bookmarkIds: string[]; followedClubs: string[]; followedCategories: Category[]; signedIn: boolean };
  children: React.ReactNode;
}) {
  const [bookmarks, setBookmarks] = useState(() => new Set(initial.bookmarkIds));
  const [clubs, setClubs] = useState(() => new Set(initial.followedClubs));
  const [categories, setCategories] = useState(() => new Set(initial.followedCategories));
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const needSignIn = useCallback(
    (what: string) => {
      toast(`Sign in to ${what}`, {
        description: "It's free. Any email works.",
        action: { label: "Sign in", onClick: () => router.push(`/login?next=${encodeURIComponent(pathname)}`) },
      });
    },
    [router, pathname],
  );

  function optimistic<T>(
    set: React.Dispatch<React.SetStateAction<Set<T>>>,
    key: T,
    on: boolean,
    call: () => Promise<ActionResult<boolean>>,
    msgs: { on: string; off: string; auth: string },
  ) {
    if (!initial.signedIn) return needSignIn(msgs.auth);
    const apply = (v: boolean) =>
      set((prev) => {
        const next = new Set(prev);
        if (v) next.add(key);
        else next.delete(key);
        return next;
      });
    apply(on);
    if (on && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    start(async () => {
      const r = await call();
      if (!r.ok) {
        apply(!on);
        if (r.needsAuth) needSignIn(msgs.auth);
        else toast.error(r.error);
        return;
      }
      toast.success(on ? msgs.on : msgs.off);
    });
  }

  const value = useMemo<Ctx>(
    () => ({
      bookmarks,
      clubs,
      categories,
      signedIn: initial.signedIn,
      pending,
      setBookmark: (id, on, label) =>
        optimistic(setBookmarks, id, on, () => toggleBookmark(id, on), {
          on: label ? `Saved "${label}"` : "Saved",
          off: "Removed from saved",
          auth: "save events",
        }),
      setFollowClub: (id, on, label) =>
        optimistic(setClubs, id, on, () => toggleFollowClub(id, on), {
          on: `Following ${label ?? "club"}`,
          off: `Unfollowed ${label ?? "club"}`,
          auth: "follow clubs",
        }),
      setFollowCategory: (c, on) =>
        optimistic(setCategories, c, on, () => toggleFollowCategory(c, on), {
          on: `Following ${c}`,
          off: `Unfollowed ${c}`,
          auth: "follow categories",
        }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookmarks, clubs, categories, pending, initial.signedIn, needSignIn],
  );

  return <UserStateCtx.Provider value={value}>{children}</UserStateCtx.Provider>;
}

export function useUserState() {
  const v = useContext(UserStateCtx);
  if (!v) throw new Error("useUserState must be inside UserStateProvider");
  return v;
}
