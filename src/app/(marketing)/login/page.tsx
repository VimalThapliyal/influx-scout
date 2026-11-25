import { Suspense } from "react";
import { MarketingShell } from "@/components/MarketingShell";
import LoginPage from "./LoginForm";

export default function Login() {
  return (
    <MarketingShell>
      <Suspense fallback={<div className="py-16 text-center text-muted">Loading</div>}>
        <LoginPage />
      </Suspense>
    </MarketingShell>
  );
}
