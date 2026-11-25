import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canViewEmails } from "@/lib/auth";
import { redactChannels } from "@/lib/email";
import { targetMarketOrFilter } from "@/lib/markets";
import { INDEPENDENT_FILTER, OUTREACH_EMAIL, activeSince } from "@/lib/library-counts";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q");
    const tier = searchParams.get("tier");
    const minSubs = searchParams.get("min_subscribers");
    const maxSubs = searchParams.get("max_subscribers");
    const minAvgViews = searchParams.get("min_avg_views");
    const country = searchParams.get("country");
    const niche = searchParams.get("niche");
    const market = searchParams.get("market");
    const hasEmail = searchParams.get("has_email");
    const hasSocial = searchParams.get("has_social");
    const hasContact = searchParams.get("has_contact");
    const hasContactForm = searchParams.get("has_contact_form");
    const uploadedWithinDays = searchParams.get("uploaded_within_days");
    const quality = searchParams.get("quality"); // ready | emerging | inactive
    const kind = searchParams.get("kind"); // independent | organisation
    const sortParam = searchParams.get("sort") ?? "avg_views_last5";
    const allowedSorts = new Set([
      "influencer_score",
      "last_updated",
      "subscriber_count",
      "created_at",
      "avg_views_last5",
      "latest_upload_at",
    ]);
    const sort = allowedSorts.has(sortParam) ? sortParam : "avg_views_last5";
    const order = searchParams.get("order") === "asc";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

    const applyFilters = (useNiche: boolean, useQuality: boolean) => {
      // Creators who asked to be removed (/remove-my-listing) never appear.
      // "estimated": exact for small result sets, planner estimate for large ones —
      // an exact count scans ~200k wide rows and hits the statement timeout.
      // Listed creators are a small set (a partial index covers them), so their
      // count is exact and matches the totals shown elsewhere on the site.
      const countMode = useQuality && quality === "ready" ? "exact" : "estimated";
      let query = supabase.from("channels").select("*", { count: countMode }).is("opted_out_at", null);
      if (kind === "independent") query = query.or(INDEPENDENT_FILTER);
      else if (kind === "organisation") query = query.eq("channel_kind", "organisation");


      if (q) {
        query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      }
      if (tier) query = query.eq("tier", tier);
      if (minSubs) query = query.gte("subscriber_count", parseInt(minSubs, 10));
      if (maxSubs) query = query.lte("subscriber_count", parseInt(maxSubs, 10));
      if (minAvgViews) {
        // Prefer last-5 when present
        query = query.or(
          `avg_views_last5.gte.${parseInt(minAvgViews, 10)},and(avg_views_last5.is.null,avg_views_per_video.gte.${parseInt(minAvgViews, 10)})`
        );
      }
      if (country) query = query.eq("country", country);
      else if (market === "us-eu") query = query.or(targetMarketOrFilter());
      if (useNiche && niche) {
        query = query.or(`primary_niche.eq.${niche},category.eq.${niche}`);
      }
      if (hasEmail === "true") query = query.or(OUTREACH_EMAIL);
      if (hasContactForm === "true") query = query.eq("has_contact_form", true);
      // Email or a contact form on the creator's own site.
      if (searchParams.get("has_direct_contact") === "true") {
        query = query.or(`${OUTREACH_EMAIL},has_contact_form.eq.true`);
      }
      if (hasSocial === "true") {
        query = query.or(
          "instagram.not.is.null,twitter.not.is.null,tiktok.not.is.null,website.not.is.null"
        );
      }
      if (hasContact === "true") {
        query = query.or(
          "email.not.is.null,has_contact_form.eq.true,instagram.not.is.null,twitter.not.is.null,tiktok.not.is.null,website.not.is.null"
        );
      }
      if (useQuality && quality === "ready") {
        // Same definition of "listed" as the rest of the site: passing and active.
        query = query.eq("quality_pass", true).gte("latest_upload_at", activeSince());
      } else if (useQuality && quality === "emerging") {
        query = query.eq("is_emerging", true);
      } else if (useQuality && quality === "inactive") {
        query = query.eq("is_inactive", true);
      }
      if (uploadedWithinDays) {
        const days = parseInt(uploadedWithinDays, 10);
        if (Number.isFinite(days) && days > 0) {
          const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
          // Prefer latest_upload_at; fallback last_updated for unscored rows
          query = query.or(
            `latest_upload_at.gte.${cutoff},and(latest_upload_at.is.null,last_updated.gte.${cutoff})`
          );
        }
      }

      return query
        .order(sort, { ascending: order, nullsFirst: false })
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1);
    };

    let { data, error, count } = await applyFilters(Boolean(niche), Boolean(quality));

    if (
      error &&
      niche &&
      /primary_niche|schema cache/i.test(error.message)
    ) {
      ({ data, error, count } = await applyFilters(false, Boolean(quality)));
    }
    if (
      error &&
      quality &&
      /quality_pass|is_emerging|is_inactive|latest_upload_at|avg_views_last5/i.test(
        error.message
      )
    ) {
      ({ data, error, count } = await applyFilters(Boolean(niche), false));
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const canView = await canViewEmails();
    const total = count ?? 0;

    return NextResponse.json({
      channels: redactChannels(data ?? [], canView),
      total,
      limit,
      offset,
      has_more: offset + (data?.length ?? 0) < total,
      emails_locked: !canView,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list channels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
