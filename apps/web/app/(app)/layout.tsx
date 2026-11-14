import { TopNav } from "@/components/layout/top-nav";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { CommandPaletteProvider } from "@/components/layout/command-palette";
import { UserStateProvider } from "@/components/auth/user-state";
import { getSessionUser } from "@/lib/server/session";
import { getUserView } from "@/lib/server/data";

export default async function AppLayout({ children, modal }: LayoutProps<"/"> & { modal: React.ReactNode }) {
  const user = await getSessionUser();
  const view = user ? await getUserView(user.uid).catch(() => null) : null;
  return (
    <UserStateProvider
      key={user?.uid ?? "anon"}
      initial={{
        signedIn: !!user,
        bookmarkIds: view?.bookmarkIds ?? [],
        followedClubs: view?.followedClubs ?? [],
        followedCategories: view?.followedCategories ?? [],
      }}
    >
      <CommandPaletteProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:shadow-lg">
          Skip to content
        </a>
        <TopNav />
        <main id="main" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-16">
          {children}
        </main>
        {modal}
        <MobileTabBar />
      </CommandPaletteProvider>
    </UserStateProvider>
  );
}
