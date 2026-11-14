"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, useAuth } from "./auth-provider";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const STRENGTH = ["Too short", "Weak", "Okay", "Good", "Strong"];

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-err`} className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const errs = {
    email: !EMAIL_RE.test(email) ? "Enter a valid email." : undefined,
    password: mode === "signup" && password.length < 8 ? "At least 8 characters." : !password ? "Enter your password." : undefined,
  };
  const valid = !errs.email && !errs.password;
  const s = strength(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!valid) return;
    setBusy("form");
    setError(null);
    try {
      if (mode === "signup") await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      toast.success(mode === "signup" ? "Welcome to Clubo!" : "Signed in");
      router.replace(dest);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setBusy("google");
    setError(null);
    try {
      await signInWithGoogle();
      router.replace(dest);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-5xl">{mode === "signup" ? "Join Clubo" : "Welcome back"}</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "signup" ? "Any email works. It takes ten seconds." : "Sign in to see your saved events."}
        </p>
      </div>
      <form onSubmit={submit} noValidate className="space-y-4">
        {mode === "signup" && (
          <Field id="name" label="Name (optional)">
            <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </Field>
        )}
        <Field id="email" label="Email" error={touched.email ? errs.email : undefined}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={touched.email && !!errs.email}
            aria-describedby={touched.email && errs.email ? "email-err" : undefined}
            className="h-11"
          />
        </Field>
        <Field id="password" label="Password" error={touched.password ? errs.password : undefined}>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            aria-invalid={touched.password && !!errs.password}
            aria-describedby={touched.password && errs.password ? "password-err" : mode === "signup" ? "pw-strength" : undefined}
            className="h-11"
          />
          {mode === "signup" && password && (
            <div id="pw-strength" className="space-y-1" aria-live="polite">
              <div className="flex gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={cn("h-1 flex-1 rounded-full bg-muted transition-colors", i < s && (s <= 1 ? "bg-danger" : s === 2 ? "bg-warning" : "bg-success"))} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Strength: {STRENGTH[s]}</p>
            </div>
          )}
        </Field>
        {mode === "login" && (
          <div className="-mt-1 text-right">
            <Link href="/reset" className="text-xs text-muted-foreground underline-offset-2 hover:underline">Forgot password?</Link>
          </div>
        )}
        {error && <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="h-11 w-full rounded-full" disabled={!!busy}>
          {busy === "form" && <Loader2 className="animate-spin" aria-hidden />}
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" size="lg" className="h-11 w-full rounded-full" onClick={google} disabled={!!busy}>
        {busy === "google" ? <Loader2 className="animate-spin" aria-hidden /> : <GoogleMark />}
        Continue with Google
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "signup" ? "Already have an account? " : "New here? "}
        <Link href={`/${mode === "signup" ? "login" : "signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-foreground underline-offset-2 hover:underline">
          {mode === "signup" ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}
