import { inferTags } from "./tags";

export type OutreachGoal =
  | "sponsorship"
  | "product_review"
  | "brand_partnership"
  | "affiliate";

export type OutreachTone = "professional" | "friendly" | "casual";

export interface OutreachChannelContext {
  title: string;
  description?: string | null;
  handle?: string | null;
  subscriber_count?: number | null;
  tier?: string | null;
  avg_views_per_video?: number | null;
  influencer_score?: number;
}

export interface OutreachRequest {
  channel: OutreachChannelContext;
  brandName: string;
  senderName: string;
  goal: OutreachGoal;
  tone: OutreachTone;
  campaignName?: string;
  customNotes?: string;
}

export interface OutreachEmail {
  subject: string;
  body: string;
  source: "ai" | "template";
}

function formatSubs(n: number | null | undefined): string {
  if (n == null) return "your audience";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M subscribers`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K subscribers`;
  return `${n.toLocaleString()} subscribers`;
}

const GOAL_LABELS: Record<OutreachGoal, string> = {
  sponsorship: "a sponsored video collaboration",
  product_review: "an honest product review",
  brand_partnership: "a long-term brand partnership",
  affiliate: "an affiliate partnership",
};

const TONE_OPENERS: Record<OutreachTone, string> = {
  professional: "I hope this message finds you well.",
  friendly: "Hope you're having a great week!",
  casual: "Hey — reaching out because I think there's a great fit here.",
};

export function generateTemplateEmail(req: OutreachRequest): OutreachEmail {
  const tags = inferTags(req.channel.title, req.channel.description);
  const niche = tags[0] ?? "content";
  const creatorName = req.channel.title.split(/[|–-]/)[0].trim();
  const subs = formatSubs(req.channel.subscriber_count);
  const goal = GOAL_LABELS[req.goal];
  const opener = TONE_OPENERS[req.tone];
  const campaignLine = req.campaignName
    ? `We're putting together our "${req.campaignName}" campaign and`
    : "We";

  const subject =
    req.tone === "casual"
      ? `Collab idea for ${creatorName}?`
      : `Partnership opportunity — ${req.brandName} × ${creatorName}`;

  const body = `Hi ${creatorName},

${opener}

I'm ${req.senderName} from ${req.brandName}. ${campaignLine} came across your ${niche.toLowerCase()} channel (${subs}) and were impressed by the quality and engagement of your content.

We'd love to explore ${goal} with you. Your style aligns well with our brand, and we think your audience would genuinely connect with what we're building.

${req.customNotes ? `${req.customNotes}\n\n` : ""}Would you be open to a quick chat this week? Happy to share more details about the collaboration, deliverables, and compensation.

Looking forward to hearing from you!

Best,
${req.senderName}
${req.brandName}`;

  return { subject, body, source: "template" };
}

export async function generateAiEmail(req: OutreachRequest): Promise<OutreachEmail> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return generateTemplateEmail(req);

  const tags = inferTags(req.channel.title, req.channel.description);
  const prompt = `Write a concise influencer outreach email.

Brand: ${req.brandName}
Sender: ${req.senderName}
Creator channel: ${req.channel.title}
Handle: ${req.channel.handle ?? "unknown"}
Subscribers: ${req.channel.subscriber_count ?? "unknown"}
Tier: ${req.channel.tier ?? "unknown"}
Niche tags: ${tags.join(", ") || "general"}
Goal: ${GOAL_LABELS[req.goal]}
Tone: ${req.tone}
${req.campaignName ? `Campaign: ${req.campaignName}` : ""}
${req.customNotes ? `Extra notes: ${req.customNotes}` : ""}
${req.channel.description ? `Channel description excerpt: ${req.channel.description.slice(0, 300)}` : ""}

Rules:
- Return JSON only: {"subject":"...","body":"..."}
- Keep body under 180 words
- Mention something specific about their channel/niche
- Include a clear call to action
- Do not use placeholder brackets like [Name]`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: "You write effective influencer outreach emails. Respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    return generateTemplateEmail(req);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? content) as { subject?: string; body?: string };
    if (parsed.subject && parsed.body) {
      return { subject: parsed.subject, body: parsed.body, source: "ai" };
    }
  } catch {
    // fall through
  }

  return generateTemplateEmail(req);
}

export function buildMailtoLink(email: string, subject: string, body: string): string {
  const params = new URLSearchParams({
    subject,
    body,
  });
  return `mailto:${encodeURIComponent(email)}?${params.toString()}`;
}
