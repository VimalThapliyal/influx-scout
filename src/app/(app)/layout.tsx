import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav, MobileTopBar } from "@/components/MobileNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <AppSidebar />
      <MobileTopBar />
      <MobileNav />
      <main className="min-h-screen overflow-x-hidden pt-14 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:pl-64 md:pt-0">
        <div className="mx-auto min-w-0 max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
