/** Safe UI labels for email validation (scrape.txt §19.3). */

export type EmailValidationStatus =
  | "public_source_found"
  | "format_valid"
  | "mx_valid"
  | "provider_verified"
  | "risky"
  | "invalid"
  | "unknown";

const LABELS: Record<EmailValidationStatus, string> = {
  public_source_found: "Public source found",
  format_valid: "Email format valid",
  mx_valid: "Mail domain configured",
  provider_verified: "Provider verified",
  risky: "Needs review",
  invalid: "Invalid format",
  unknown: "Not validated",
};

export function emailValidationLabel(
  status: string | null | undefined
): string | null {
  if (!status) return null;
  if (status in LABELS) return LABELS[status as EmailValidationStatus];
  return null;
}

export function emailValidationTone(
  status: string | null | undefined
): "ok" | "warn" | "bad" | "neutral" {
  switch (status) {
    case "mx_valid":
    case "provider_verified":
    case "public_source_found":
    case "format_valid":
      return "ok";
    case "risky":
      return "warn";
    case "invalid":
      return "bad";
    default:
      return "neutral";
  }
}
