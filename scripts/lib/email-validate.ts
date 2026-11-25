/**
 * Free email validation layers (scrape.txt §19).
 * Does NOT claim mailbox deliverability.
 */

import { promises as dns } from "node:dns";

export type EmailValidationStatus =
  | "public_source_found"
  | "format_valid"
  | "mx_valid"
  | "provider_verified"
  | "risky"
  | "invalid"
  | "unknown";

export type EmailValidationResult = {
  normalized: string | null;
  status: EmailValidationStatus;
  isRole: boolean;
  isDisposable: boolean;
  domain: string | null;
  hasMx: boolean | null;
  reason: string;
};

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "discard.email",
  "maildrop.cc",
]);

const ROLE_LOCALS = new Set([
  "admin",
  "administrator",
  "info",
  "contact",
  "hello",
  "hi",
  "support",
  "help",
  "sales",
  "marketing",
  "team",
  "office",
  "billing",
  "noreply",
  "no-reply",
  "donotreply",
  "postmaster",
  "webmaster",
  "abuse",
  "privacy",
  "legal",
  "press",
]);

const BUSINESS_ROLE_OK = new Set([
  "partnerships",
  "partnership",
  "sponsors",
  "sponsorship",
  "collab",
  "collaborate",
  "business",
  "booking",
  "bookings",
  "mgmt",
  "management",
  "talent",
  "media",
  "pr",
]);

/**
 * Inboxes that exist for something other than partnerships: customer service,
 * privacy officers, web shops, ticketing. A brand deal sent there goes nowhere,
 * so these are never stored or counted as outreach contacts.
 */
const NON_OUTREACH_LOCALS = new Set([
  "customerservice", "customer-service", "customer.service", "customercare", "customersupport",
  "support", "help", "helpdesk", "service", "webmaster", "postmaster", "hostmaster",
  "dpo", "privacy", "gdpr", "legal", "compliance", "abuse", "security", "dmca", "copyright",
  "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply", "mailer-daemon",
  "shop", "store", "orders", "order", "returns", "shipping", "billing", "invoices", "accounts", "payments",
  "tickets", "tours", "reservations", "careers", "jobs", "hr", "recruiting", "recruitment",
  "newsletter", "unsubscribe", "subscriptions", "donations", "donate", "membership",
]);

export function isNonOutreachAddress(email: string): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  const base = ((e.split("@")[0] ?? "").split("+")[0] ?? "").replace(/\d+$/, "");
  return NON_OUTREACH_LOCALS.has(base);
}

const SYNTAX_RE =
  /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmail(email: string): string | null {
  const e = email.trim().toLowerCase().replace(/^mailto:/i, "");
  if (!e || e.length > 120) return null;
  return e;
}

export function isValidEmailSyntax(email: string): boolean {
  const e = normalizeEmail(email);
  if (!e || !SYNTAX_RE.test(e)) return false;
  if (e.includes("..")) return false;
  return true;
}

export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

/** Role inbox; partnerships/booking counts as business-ok role, still flagged. */
export function isRoleAddress(email: string): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  const local = e.split("@")[0] ?? "";
  const base = local.split("+")[0] ?? local;
  if (BUSINESS_ROLE_OK.has(base)) return true;
  return ROLE_LOCALS.has(base);
}

export async function domainHasMx(domain: string): Promise<boolean> {
  try {
    const mx = await dns.resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    try {
      // Some domains only publish A/AAAA and accept mail there — treat as weak MX-like
      const a = await dns.resolve4(domain);
      return Array.isArray(a) && a.length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Validate a public email candidate.
 * `hasPublicSource` elevates format_valid → public_source_found when MX not checked yet,
 * and mx_valid when MX passes.
 */
export async function validatePublicEmail(
  email: string,
  opts?: { hasPublicSource?: boolean; checkMx?: boolean }
): Promise<EmailValidationResult> {
  const checkMx = opts?.checkMx !== false;
  const hasPublicSource = opts?.hasPublicSource !== false;

  const normalized = normalizeEmail(email);
  if (!normalized || !isValidEmailSyntax(normalized)) {
    return {
      normalized: null,
      status: "invalid",
      isRole: false,
      isDisposable: false,
      domain: null,
      hasMx: null,
      reason: "Invalid email format",
    };
  }

  const domain = normalized.split("@")[1] ?? "";
  const isRole = isRoleAddress(normalized);
  const isDisposable = isDisposableDomain(domain);

  if (isDisposable) {
    return {
      normalized,
      status: "risky",
      isRole,
      isDisposable: true,
      domain,
      hasMx: null,
      reason: "Disposable email domain",
    };
  }

  if (!checkMx) {
    return {
      normalized,
      status: hasPublicSource ? "public_source_found" : "format_valid",
      isRole,
      isDisposable: false,
      domain,
      hasMx: null,
      reason: hasPublicSource
        ? "Public source found; format valid"
        : "Email format valid",
    };
  }

  const hasMx = await domainHasMx(domain);
  if (!hasMx) {
    return {
      normalized,
      status: "risky",
      isRole,
      isDisposable: false,
      domain,
      hasMx: false,
      reason: "No MX / DNS records for domain",
    };
  }

  // Generic role inboxes are usable but tagged risky if not business roles
  const local = (normalized.split("@")[0] ?? "").split("+")[0] ?? "";
  if (!BUSINESS_ROLE_OK.has(local) && isNonOutreachAddress(normalized)) {
    return {
      normalized,
      status: "risky",
      isRole: true,
      isDisposable: false,
      domain,
      hasMx: true,
      reason: "Non-outreach role address",
    };
  }

  return {
    normalized,
    status: "mx_valid",
    isRole,
    isDisposable: false,
    domain,
    hasMx: true,
    reason: hasPublicSource
      ? "Public source found; mail domain configured"
      : "Mail domain configured",
  };
}
