"use client";

import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserState } from "@/components/auth/user-state";

export function FollowButton({ clubId, clubName, size = "default" }: { clubId: string; clubName: string; size?: "sm" | "default" | "lg" }) {
  const { clubs, setFollowClub } = useUserState();
  const on = clubs.has(clubId);
  return (
    <Button
      size={size}
      variant={on ? "outline" : "default"}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        setFollowClub(clubId, !on, clubName);
      }}
      className="min-w-28 rounded-full"
    >
      {on ? <Check aria-hidden /> : <Plus aria-hidden />}
      {on ? "Following" : "Follow"}
    </Button>
  );
}
