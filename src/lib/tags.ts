import {
  nicheLabel,
  type NicheSlug,
} from "@/lib/classify";

const TAG_KEYWORDS: Record<string, string[]> = {
  Lifestyle: ["lifestyle", "vlog", "daily", "life"],
  Technology: ["tech", "technology", "software", "coding", "programming"],
  Engineering: ["engineering", "civil", "construction", "mechanical"],
  Fashion: ["fashion", "style", "outfit", "beauty"],
  Fitness: ["fitness", "workout", "gym", "health"],
  Travel: ["travel", "tourism", "adventure", "trip"],
  Gaming: ["gaming", "game", "gamer", "esports"],
  Education: ["education", "tutorial", "learn", "course"],
  Food: ["food", "cooking", "recipe", "kitchen"],
  Entertainment: ["entertainment", "comedy", "funny", "music"],
};

export function inferTags(
  title: string,
  description?: string | null,
  primaryNiche?: string | null
): string[] {
  if (primaryNiche) {
    return [nicheLabel(primaryNiche as NicheSlug)];
  }

  const text = `${title} ${description ?? ""}`.toLowerCase();
  const tags: string[] = [];

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags.slice(0, 4);
}

export function countryLabel(code: string | null): string {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function youtubeAboutUrl(channel: { id: string; handle?: string | null }): string {
  if (channel.handle) {
    const h = channel.handle.startsWith("@") ? channel.handle : `@${channel.handle}`;
    return `https://www.youtube.com/${h}/about`;
  }
  return `https://www.youtube.com/channel/${channel.id}/about`;
}

export function youtubeChannelUrl(channel: { id: string; handle?: string | null }): string {
  if (channel.handle) {
    const h = channel.handle.startsWith("@") ? channel.handle : `@${channel.handle}`;
    return `https://www.youtube.com/${h}`;
  }
  return `https://www.youtube.com/channel/${channel.id}`;
}
