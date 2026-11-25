/**
 * The one place creator totals come from, so the homepage, dashboard, pricing
 * and lists never disagree. "Listed" = passes the quality checks and has not
 * asked to be removed, and uploaded in the last 45 days. Server-only.
 */
import { cache } from "react";
import { getSupabaseAdmin } from "./supabase";

export interface LibraryCounts {
  /** Creators passing the quality checks. */
  listed: number;
  /** Listed creators that are independent (not a studio, network, label or brand). */
  independent: number;
  /** Listed creators with a public business email. */
  withEmail: number;
  /** Listed creators with a public email or a contact form on their own site. */
  reachable: number;
}

/** A listed creator must have uploaded within this many days (the pages promise it). */
export const ACTIVE_DAYS = 45;
export const activeSince = () => new Date(Date.now() - ACTIVE_DAYS * 86_400_000).toISOString();

/** PostgREST filter: independent creators, including ones not classified yet. */
export const INDEPENDENT_FILTER = "channel_kind.is.null,channel_kind.eq.independent";

export const getLibraryCounts = cache(async (): Promise<LibraryCounts | null> => {
  try {
    const db = getSupabaseAdmin();
    const listed = () =>
      db.from("channels").select("id", { count: "exact", head: true }).eq("quality_pass", true).is("opted_out_at", null).gte("latest_upload_at", activeSince());
    const [all, independent, withEmail, reachable] = await Promise.all([
      listed(),
      listed().or(INDEPENDENT_FILTER),
      listed().not("email", "is", null),
      listed().or("email.not.is.null,has_contact_form.eq.true"),
    ]);
    if (all.error || all.count == null) return null;
    return {
      listed: all.count,
      independent: independent.count ?? all.count,
      withEmail: withEmail.count ?? 0,
      reachable: reachable.count ?? 0,
    };
  } catch {
    return null;
  }
});
