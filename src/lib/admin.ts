import { getSessionUser } from "./auth";

/** Comma-separated emails in ADMIN_EMAILS (case-insensitive). */
export function getAdminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = getAdminEmailAllowlist();
  if (allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}

export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return isAdminEmail(user?.email);
}

export async function requireAdmin(): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>> }
  | { ok: false; status: 401 | 403; error: string }
> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, status: 401, error: "Sign in required" };
  }
  if (!isAdminEmail(user.email)) {
    return { ok: false, status: 403, error: "Admin access required" };
  }
  return { ok: true, user };
}
