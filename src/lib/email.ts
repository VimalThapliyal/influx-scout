/** Mask influencer email for non-subscribers */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "••••••••@•••••.com";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  const visible = local.length > 0 ? local[0] : "•";
  const stars = "•".repeat(Math.min(Math.max(local.length - 1, 4), 6));

  return `${visible}${stars}@${domain}`;
}

export function hasEmailValue(email: string | null | undefined): boolean {
  return !!email && email.length > 3 && email.includes("@");
}

const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export type ChannelWithEmail = {
  email?: string | null;
  [key: string]: unknown;
};

/** Strip email from channel object when user is not subscribed */
export function redactChannelEmail<T extends ChannelWithEmail>(
  channel: T,
  canView: boolean
): T & { email_masked?: string | null; email_locked: boolean; has_email: boolean } {
  const hasEmail = hasEmailValue(channel.email);

  if (!hasEmail) {
    return { ...channel, email_masked: null, email_locked: false, has_email: false };
  }

  if (canView) {
    return {
      ...channel,
      email_masked: channel.email ?? null,
      email_locked: false,
      has_email: true,
    };
  }

  return {
    ...channel,
    // The bio often repeats the business email in plain text; hide it too.
    ...(typeof channel.description === "string"
      ? { description: channel.description.replace(EMAIL_IN_TEXT, "[email hidden]") }
      : {}),
    email: null,
    email_masked: maskEmail(channel.email!),
    email_locked: true,
    has_email: true,
  };
}

export function redactChannels<T extends ChannelWithEmail>(
  channels: T[],
  canView: boolean
): (T & { email_masked?: string | null; email_locked: boolean })[] {
  return channels.map((ch) => redactChannelEmail(ch, canView));
}
