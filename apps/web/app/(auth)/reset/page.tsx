"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, useAuth } from "@/components/auth/auth-provider";

export default function ResetPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-10 text-success" aria-hidden />
        <h1 className="font-display text-4xl">Check your email</h1>
        <p className="text-sm text-muted-foreground">If there&rsquo;s an account for {email}, we sent a link to reset your password.</p>
        <Button asChild variant="outline" className="rounded-full"><Link href="/login">Back to sign in</Link></Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        setError(null);
        try {
          await resetPassword(email.trim());
          setState("sent");
        } catch (err) {
          setError(authErrorMessage(err));
          setState("idle");
        }
      }}
    >
      <div className="space-y-1">
        <h1 className="font-display text-5xl">Reset password</h1>
        <p className="text-sm text-muted-foreground">We&rsquo;ll email you a link to choose a new one.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
      </div>
      {error && <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" className="h-11 w-full rounded-full" disabled={state === "busy"}>
        {state === "busy" && <Loader2 className="animate-spin" aria-hidden />} Send reset link
      </Button>
      <p className="text-center text-sm"><Link href="/login" className="text-muted-foreground hover:underline">Back to sign in</Link></p>
    </form>
  );
}
