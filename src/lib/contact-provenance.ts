/** Labels for email contact provenance (scrape.txt §5.5 / §18). */

export type EmailSourceType =
  | "description"
  | "creator_website"
  | "link_in_bio"
  | "management_website"
  | "instagram"
  | "youtube_about"
  | "other";

const TYPE_LABELS: Record<EmailSourceType, string> = {
  description: "Channel description",
  creator_website: "Creator website",
  link_in_bio: "Link-in-bio",
  management_website: "Management website",
  instagram: "Instagram",
  youtube_about: "YouTube About",
  other: "Public web",
};

export function emailSourceTypeLabel(
  type: string | null | undefined
): string | null {
  if (!type) return null;
  if (type in TYPE_LABELS) return TYPE_LABELS[type as EmailSourceType];
  return type;
}

export function emailSourceHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
