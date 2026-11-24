import { Suspense } from "react";
import { MarketingShell } from "@/components/MarketingShell";
import LoginPage from "./LoginForm";

export default function Login() {
  return (
    <MarketingShell>
      <Suspense fallback={<div className="py-16 text-center text-slate-500">Loading…</div>}>
        <LoginPage />
      </Suspense>
    </MarketingShell>
  );
}
