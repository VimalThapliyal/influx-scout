import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav, MobileTopBar } from "@/components/MobileNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppSidebar />
      <MobileTopBar />
      <MobileNav />
      <main className="min-h-screen overflow-x-hidden pt-14 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:pl-56 md:pt-0">
        <div className="mx-auto min-w-0 max-w-6xl px-4 py-5 md:px-8 md:py-7">{children}</div>
      </main>
    </div>
  );
}
