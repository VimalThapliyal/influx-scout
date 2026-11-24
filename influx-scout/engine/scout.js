/**
 * ScoutEngine — niche depth + comments + quality upsert loop.
 */
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");
const { scoreChannelQuality, qualityFieldsForDb } = require("./quality");
const {
  QuotaError,
  searchRecentVideoChannels,
  getChannelDetails,
  getUploadVideoIds,
  getVideosByIds,
  uploadsPlaylistIdFromChannelId,
  getCommentAuthorIds,
  mapChannel,
  NICHE_QUERIES,
} = require("./youtube");

function makeSupabase(url, key) {
  // Electron's Node is older than 22 — supabase realtime needs an explicit WS.
  return createClient(url, key, {
    realtime: { transport: ws },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

class ScoutEngine {
  constructor({ onLog, onStats, onDone }) {
    this.onLog = onLog || (() => {});
    this.onStats = onStats || (() => {});
    this.onDone = onDone || (() => {});
    this.stopping = false;
    this.running = false;
    this.stats = this.emptyStats();
  }

  emptyStats() {
    return {
      found: 0,
      upserted: 0,
      skipped: 0,
      qualityPass: 0,
      qualityFail: 0,
      comments: 0,
      errors: 0,
      nicheDepth: 0,
      target: 0,
      untilQuota: false,
      currentNiche: "",
      quotaHit: false,
      searchCalls: 0,
      maxSearchCalls: 0,
    };
  }

  log(level, message) {
    this.onLog({ level, message, at: new Date().toISOString() });
  }

  emitStats() {
    this.onStats({ ...this.stats });
  }

  stop() {
    this.stopping = true;
    this.log("warn", "Stop requested…");
  }

  async run(settings, job) {
    if (this.running) throw new Error("Already running");
    this.running = true;
    this.stopping = false;
    this.stats = this.emptyStats();

    const untilQuota = job.untilQuota !== false;
    const rotateNiches = Boolean(job.rotateNiches);
    const target = untilQuota
      ? Number.POSITIVE_INFINITY
      : Math.max(50, parseInt(job.target, 10) || 250);
    this.stats.target = untilQuota ? 0 : target;
    this.stats.untilQuota = untilQuota;

    // YouTube has a SEPARATE ~100 search.list calls/day bucket (not the 10k units).
    // Cap hard so rotate+deep pages can't burn it in minutes.
    const maxSearchCalls = Math.max(
      5,
      Math.min(100, parseInt(job.maxSearchCalls, 10) || 80)
    );
    this.stats.maxSearchCalls = maxSearchCalls;
    this.emitStats();

    const apiKey = settings.youtubeKey;
    if (!apiKey) throw new Error("YouTube API key required");
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      throw new Error("Supabase URL + service role key required");
    }

    const supabase = makeSupabase(settings.supabaseUrl, settings.supabaseKey);
    const window = job.window || "month";
    const doComments = Boolean(job.includeComments);
    const hardQuality = job.hardQuality !== false;
    const minSubs = Math.max(0, parseInt(job.minSubs, 10) || 1000);
    const minVideos = Math.max(0, parseInt(job.minVideos, 10) || 3);

    // Shallow pages: stretch the ~100 search budget across niches
    // rotate: 1 query × 2 pages per niche ≈ 24 searches for 12 niches
    // single: up to 8 pages on that niche's query pack (still capped by maxSearchCalls)
    const maxPages = rotateNiches ? 2 : untilQuota ? 8 : 5;
    const queriesPerNiche = rotateNiches ? 1 : 99;

    let nicheList;
    if (job.customQuery) {
      nicheList = [{ niche: job.niche || "custom", queries: [job.customQuery] }];
    } else if (rotateNiches) {
      nicheList = Object.keys(NICHE_QUERIES).map((niche) => ({
        niche,
        queries: (NICHE_QUERIES[niche] || []).slice(0, queriesPerNiche),
      }));
    } else {
      const niche = job.niche || "fitness";
      nicheList = [
        {
          niche,
          queries: (NICHE_QUERIES[niche] || [`${niche} usa`]).slice(
            0,
            untilQuota ? 3 : 99
          ),
        },
      ];
    }

    this.log(
      "info",
      untilQuota
        ? `Starting — niches=${rotateNiches ? "ALL (rotate, 1 query×2 pages each)" : nicheList[0].niche} window=${window} searchBudget=${maxSearchCalls}/day`
        : `Starting niche="${nicheList[0].niche}" window=${window} target=${target} searchBudget=${maxSearchCalls}`
    );
    this.log(
      "info",
      "Note: search.list has its own ~100 calls/day limit (separate from 10k units). Scoring uses cheap playlist/videos calls."
    );

    try {
      const seen = new Set();
      let searchExhausted = false;

      outer: for (const pack of nicheList) {
        if (this.stopping || searchExhausted) break;
        if (!untilQuota && seen.size >= target) break;

        this.stats.currentNiche = pack.niche;
        this.log("info", `══ Niche: ${pack.niche} ══`);

        for (const q of pack.queries) {
          if (this.stopping || searchExhausted) break;
          if (!untilQuota && seen.size >= target) break;

          this.log("info", `Query: "${q}"`);
          let pageToken = null;

          for (let page = 0; page < maxPages && !this.stopping; page++) {
            if (!untilQuota && seen.size >= target) break;
            if (this.stats.searchCalls >= maxSearchCalls) {
              searchExhausted = true;
              this.log(
                "warn",
                `⏹ Search budget reached (${maxSearchCalls} search.list calls). Stop discovery for today — try another key or tomorrow. Already-found channels are scored with cheap APIs.`
              );
              break outer;
            }

            let result;
            try {
              this.stats.searchCalls++;
              this.emitStats();
              result = await searchRecentVideoChannels(apiKey, q, {
                window,
                maxResults: 25,
                pageToken,
                regionCode: "US",
              });
            } catch (err) {
              if (err instanceof QuotaError) {
                searchExhausted = true;
                this.stats.quotaHit = true;
                if (err.kind === "search") {
                  this.log(
                    "error",
                    "⏹ Search Queries daily limit hit (~100/day). Scoring/channels.list may still work tomorrow with a fresh search budget. Use another YouTube API key project to continue discovering today."
                  );
                } else {
                  this.log(
                    "error",
                    "⏹ YouTube unit quota exhausted — try again tomorrow."
                  );
                }
                break outer;
              }
              throw err;
            }

            pageToken = result.nextPageToken;
            const newIds = result.channelIds.filter((id) => !seen.has(id));
            this.log(
              "info",
              `  page ${page + 1}: ${result.channelIds.length} channels, ${newIds.length} new (search ${this.stats.searchCalls}/${maxSearchCalls})`
            );

            if (doComments && result.videoIds?.length && !this.stopping) {
              const vids = result.videoIds.slice(0, 3);
              for (const vid of vids) {
                if (this.stopping) break;
                if (!untilQuota && seen.size >= target) break;
                try {
                  const authors = await getCommentAuthorIds(apiKey, vid, 12);
                  for (const aid of authors) {
                    if (!seen.has(aid) && (untilQuota || seen.size < target)) {
                      newIds.push(aid);
                      this.stats.comments++;
                    }
                  }
                  this.log(
                    "info",
                    `  comments on ${vid}: +${authors.length} authors`
                  );
                } catch (err) {
                  this.log(
                    "warn",
                    `  comments skip: ${err.message?.slice(0, 100)}`
                  );
                }
              }
              this.emitStats();
            }

            const uniqueNew = [...new Set(newIds)].filter((id) => !seen.has(id));
            if (uniqueNew.length) {
              await this.ingestChannels(apiKey, supabase, uniqueNew, seen, {
                niche: pack.niche,
                window,
                hardQuality,
                minSubs,
                minVideos,
                target: untilQuota ? Number.POSITIVE_INFINITY : target,
                source: `scout:niche:${pack.niche}`,
              });
            }

            this.stats.nicheDepth = seen.size;
            this.stats.found = seen.size;
            this.emitStats();
            if (!pageToken) break;
          }
        }
      }

      if (this.stopping) {
        this.log("warn", "Stopped by user.");
      } else if (!this.stats.quotaHit) {
        this.log(
          "info",
          untilQuota || searchExhausted
            ? `Discovery pass done. searchCalls=${this.stats.searchCalls}/${maxSearchCalls} upserted=${this.stats.upserted}`
            : `Done. depth=${seen.size}/${target} upserted=${this.stats.upserted}`
        );
      }
      this.log(
        "info",
        `Summary: found=${seen.size} upserted=${this.stats.upserted} skipped=${this.stats.skipped} pass=${this.stats.qualityPass} fail=${this.stats.qualityFail} searches=${this.stats.searchCalls}`
      );
    } catch (err) {
      if (err instanceof QuotaError) {
        this.stats.quotaHit = true;
        this.log(
          "error",
          err.kind === "search"
            ? "⏹ Search Queries daily limit — try another API key project or wait until tomorrow (~midnight Pacific)."
            : "⏹ YouTube daily quota exhausted — try again tomorrow."
        );
        this.log(
          "info",
          `Saved before stop: upserted=${this.stats.upserted} pass=${this.stats.qualityPass}`
        );
      } else {
        this.log("error", err.message || String(err));
        this.stats.errors++;
      }
      this.emitStats();
    } finally {
      this.running = false;
      this.onDone({ ...this.stats });
    }
  }

  async ingestChannels(apiKey, supabase, channelIds, seen, opts) {
    const details = await getChannelDetails(apiKey, channelIds);
    const now = new Date().toISOString();
    const target = opts.target ?? Number.POSITIVE_INFINITY;
    const minSubs = opts.minSubs ?? 1000;
    const minVideos = opts.minVideos ?? 3;

    // Phase 1 — floor filter + collect uploads playlist video IDs
    const eligible = [];
    for (const item of details) {
      if (this.stopping) break;
      if (seen.has(item.id)) continue;
      if (Number.isFinite(target) && seen.size >= target) break;

      seen.add(item.id);
      this.stats.found = seen.size;

      const mapped = mapChannel(item);
      const subs = mapped.subscriber_count ?? 0;
      const vids = mapped.video_count ?? 0;

      if (subs < minSubs || vids < minVideos) {
        this.stats.skipped++;
        this.log(
          "warn",
          `✗ skip ${mapped.title} — ${subs} subs / ${vids} videos (need ≥${minSubs} / ≥${minVideos})`
        );
        this.emitStats();
        continue;
      }

      const uploadsId = uploadsPlaylistIdFromChannelId(
        mapped.id,
        mapped.uploadsPlaylistId
      );
      let videoIds = [];
      try {
        videoIds = await getUploadVideoIds(apiKey, uploadsId, 5);
      } catch (err) {
        if (err instanceof QuotaError) throw err;
        this.log("warn", `playlist ${mapped.id}: ${err.message}`);
        this.stats.errors++;
        continue;
      }
      eligible.push({ mapped, videoIds });
    }

    if (!eligible.length) return;

    // Phase 2 — one batched videos.list (≤50 IDs / unit) across the batch
    const allVideoIds = eligible.flatMap((e) => e.videoIds);
    let videoMap = new Map();
    try {
      videoMap = await getVideosByIds(apiKey, allVideoIds);
      this.log(
        "info",
        `  batched videos.list: ${allVideoIds.length} ids → ${Math.ceil(Math.max(allVideoIds.length, 1) / 50)} call(s)`
      );
    } catch (err) {
      if (err instanceof QuotaError) throw err;
      this.log("warn", `videos batch: ${err.message}`);
      this.stats.errors++;
      return;
    }

    // Phase 3 — score + upsert
    for (const { mapped, videoIds } of eligible) {
      if (this.stopping) break;

      const videos = videoIds.map((id) => videoMap.get(id)).filter(Boolean);
      let quality = {};
      try {
        quality = scoreChannelQuality({
          videos,
          country: mapped.country,
          subscriberCount: mapped.subscriber_count,
          primaryNiche: opts.niche,
        });
        if (quality.quality_pass) this.stats.qualityPass++;
        else this.stats.qualityFail++;
      } catch (err) {
        this.log("warn", `score ${mapped.id}: ${err.message}`);
        this.stats.errors++;
        continue;
      }

      if (opts.hardQuality !== false && quality.quality_pass === false) {
        this.stats.skipped++;
        this.log(
          "warn",
          `✗ ${mapped.title} — ${((quality.quality_fail_reasons || []).join(", ")) || "fail"}`
        );
        this.emitStats();
        continue;
      }

      const { uploadsPlaylistId, ...channelRow } = mapped;
      const row = {
        ...channelRow,
        ...qualityFieldsForDb(quality),
        primary_niche: opts.niche || null,
        discovery_source: opts.source,
        last_updated: now,
        updated_at: now,
      };
      const { error } = await supabase.from("channels").upsert(row, {
        onConflict: "id",
      });
      if (error) {
        if (
          /Could not find the|quality_|latest_upload|recent_videos|location_tier|is_emerging|activity_bucket|discovery_source|days_since/i.test(
            error.message
          )
        ) {
          const slim = {
            ...channelRow,
            primary_niche: opts.niche || null,
            last_updated: now,
            updated_at: now,
          };
          const retry = await supabase.from("channels").upsert(slim, {
            onConflict: "id",
          });
          if (retry.error) {
            this.log("error", `upsert ${mapped.id}: ${retry.error.message}`);
            this.stats.errors++;
            continue;
          }
          this.log(
            "warn",
            `Saved ${mapped.title} without full quality fields (${error.message.slice(0, 80)})`
          );
        } else {
          this.log("error", `upsert ${mapped.id}: ${error.message}`);
          this.stats.errors++;
          continue;
        }
      }

      this.stats.upserted++;
      const mark = quality.quality_pass ? "✓" : "·";
      const loc = mapped.country || "blank";
      this.log(
        "info",
        `${mark} ${mapped.title}  ${mapped.subscriber_count ?? "?"} subs  ${loc}  avg5=${quality.avg_views_last5 ?? "?"}  eng=${quality.engagement_last5 != null ? (quality.engagement_last5 * 100).toFixed(1) + "%" : "?"}`
      );
      this.emitStats();
    }
  }
}

module.exports = { ScoutEngine, NICHE_QUERIES };
