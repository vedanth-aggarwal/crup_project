import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AdminNav } from "@/components/admin/admin-nav";
import { getSessionUser } from "@/lib/server/session";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getSessionUser();
  if (!user?.admin) notFound();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b bg-card md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-baseline gap-2">
            <Logo className="text-2xl" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</span>
          </div>
          <ThemeToggle />
        </div>
        <AdminNav />
        <div className="hidden px-4 pt-6 md:block">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to site</Link>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
