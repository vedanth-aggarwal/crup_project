/**
 * Public base URL. Explicit NEXT_PUBLIC_APP_URL wins (custom domain); on Vercel
 * it falls back to the project's production domain, which Vercel injects.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && !explicit.includes("localhost")) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return (explicit || "http://localhost:3000").replace(/\/$/, "");
}
