/**
 * HTTP-only contribute loop for Electron / CLI.
 * Uses shared server claims so multiple people never process the same seeds/pending.
 */

const YT_URL_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]{22}|c\/[\w.-]+|user\/[\w.-]+)(?:\/[^\s"'<>]*)?|youtu\.be\/[\w-]+)/gi;

const HANDLE_RE = /(?:^|[^\w/])@([A-Za-z0-9._-]{3,30})\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function normalizeChannelUrl(raw) {
  try {
    const u = new URL(raw.split(/[?#]/)[0]);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "youtu.be" && host !== "m.youtube.com")
      return null;
    if (host === "youtu.be") return null;
    const path = u.pathname.replace(/\/$/, "");
    if (/^\/(watch|shorts|playlist|results|feed)/i.test(path)) return null;
    if (/^\/@[^/]+/.test(path)) {
      return `https://www.youtube.com${path.split("/").slice(0, 2).join("/")}`;
    }
    if (/^\/channel\/UC[\w-]{22}/i.test(path)) {
      const id = path.split("/")[2];
      if (id && /^UC[\w-]{22}$/i.test(id))
        return `https://www.youtube.com/channel/${id}`;
      return null;
    }
    if (/^\/(c|user)\/[^/]+/i.test(path)) {
      return `https://www.youtube.com${path.split("/").slice(0, 3).join("/")}`;
    }
    return null;
  } catch {
    return null;
  }
}

function extractYouTubeChannels(html) {
  const found = new Set();
  for (const match of html.matchAll(YT_URL_RE)) {
    const n = normalizeChannelUrl(match[0]);
    if (n) found.add(n);
  }
  for (const match of html.matchAll(
    /youtube\.com\/(@[\w.-]+|channel\/UC[\w-]{22})/gi
  )) {
    const n = normalizeChannelUrl(`https://www.youtube.com/${match[1]}`);
    if (n) found.add(n);
  }
  for (const match of html.matchAll(HANDLE_RE)) {
    const h = match[1];
    if (/^(media|font|keyframes|import|charset|supports|context|type)$/i.test(h))
      continue;
    if (h.length < 4 || h.length > 30) continue;
    // Skip website domains mistaken for @handles
    if (/\.(com|org|net|io|co|ca|ph|uk|in|au|tv|me)$/i.test(h)) continue;
    found.add(`https://www.youtube.com/@${h}`);
  }
  return Array.from(found);
}

function extractUrls(text) {
  const found = [];
  const re = /https?:\/\/[^\s<>"'\)\]]+/gi;
  let m;
  while ((m = re.exec(text))) {
    found.push(m[0].replace(/[.,;:!?)]+$/, ""));
  }
  return found;
}

function findInstagramUrl(text) {
  return (
    extractUrls(text).find((u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "").includes("instagram.com");
      } catch {
        return false;
      }
    }) || null
  );
}

function isJunkEmail(email) {
  const e = String(email || "").toLowerCase();
  return (
    !e.includes("@") ||
    /noreply|no-reply|example\.com|sentry\.io|instagram\.com|facebook\.com/i.test(
      e
    )
  );
}

async function findEmailFromInstagram(instagramUrl) {
  try {
    const res = await fetch(instagramUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const chunks = [];
    for (const m of html.matchAll(/"biography"\s*:\s*"((?:\\.|[^"\\])*)"/gi)) {
      chunks.push(
        m[1]
          .replace(/\\u0026/g, "&")
          .replace(/\\n/g, " ")
          .replace(/\\"/g, '"')
      );
    }
    for (const m of html.matchAll(
      /property="og:description"\s+content="([^"]*)"/gi
    )) {
      chunks.push(m[1]);
    }
    const blob = chunks.join(" ") + " " + html;
    const emails = [...blob.matchAll(EMAIL_RE)]
      .map((x) => (x[1] || x[0]).replace(/^mailto:/i, "").toLowerCase())
      .filter((e) => !isJunkEmail(e));
    return emails[0] || null;
  } catch {
    return null;
  }
}

function mapYtChannel(item) {
  const description = item.snippet?.description || "";
  const branding = item.brandingSettings?.channel?.description || "";
  const fullText = `${description} ${branding}`;
  const emailMatch = fullText.match(EMAIL_RE);
  const subs = item.statistics?.subscriberCount
    ? parseInt(item.statistics.subscriberCount, 10)
    : null;
  const views = item.statistics?.viewCount
    ? parseInt(item.statistics.viewCount, 10)
    : 0;
  const videos = item.statistics?.videoCount
    ? parseInt(item.statistics.videoCount, 10)
    : 0;
  let handle = item.snippet?.customUrl || null;
  if (handle && !handle.startsWith("@")) handle = `@${handle}`;
  let tier = null;
  if (subs != null) {
    if (subs >= 1_000_000) tier = "mega";
    else if (subs >= 500_000) tier = "macro";
    else if (subs >= 100_000) tier = "mid";
    else if (subs >= 10_000) tier = "micro";
    else tier = "nano";
  }
  const ig = findInstagramUrl(fullText);
  return {
    id: item.id,
    handle,
    title: item.snippet?.title || "Unknown",
    description: description || null,
    thumbnail_url:
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      null,
    subscriber_count: subs,
    view_count: views,
    video_count: videos,
    country: item.snippet?.country || null,
    published_at: item.snippet?.publishedAt || null,
    email: emailMatch?.[0]?.toLowerCase() || null,
    instagram: ig,
    tier,
  };
}

class ContributeEngine {
  constructor(opts) {
    this.apiUrl = (opts.apiUrl || "").replace(/\/$/, "");
    this.workerKey = opts.workerKey || "";
    this.youtubeKey = opts.youtubeKey || "";
    this.seedLimit = opts.seedLimit || 8;
    this.enrichLimit = opts.enrichLimit || 150;
    this.minSubs = opts.minSubs ?? 1000;
    this.usaOnly = opts.usaOnly !== false;
    this.onLog = opts.onLog || (() => {});
    this.onStats = opts.onStats || (() => {});
    this.stopping = false;
    this.stats = {
      seedsClaimed: 0,
      channelsQueued: 0,
      enriched: 0,
      rejected: 0,
      cycles: 0,
      instagramEmails: 0,
      instagramTried: 0,
    };
  }

  stop() {
    this.stopping = true;
  }

  log(msg) {
    this.onLog(msg);
  }

  bump(partial) {
    Object.assign(this.stats, partial);
    this.onStats({ ...this.stats });
  }

  async api(path, method, body, retries = 3) {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${this.apiUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.workerKey}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`${res.status} ${text.slice(0, 200) || res.statusText}`);
        }
        return await res.json();
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt < retries && /fetch failed|network|ECONNRESET|ETIMEDOUT|503|502|429/i.test(msg)) {
          this.log(`  retry ${attempt}/${retries}: ${msg}`);
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  async fetchStatus() {
    return this.api("/api/worker/status", "GET");
  }

  async fetchPage(url) {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; InfluxContributor/1.0; +https://influencer-platform-mu.vercel.app)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  async lightSave(urls) {
    let queued = 0;
    let already = 0;
    for (let i = 0; i < urls.length; i += 50) {
      const batch = urls.slice(i, i + 50).map((url) => ({ url }));
      const data = await this.api("/api/worker/submit", "POST", {
        mode: "light",
        channels: batch,
        usa_only: true,
        min_subscribers: 0,
      });
      queued += Number(data.queued || 0);
      already +=
        Number(data.already_saved || 0) + Number(data.already_pending || 0);
    }
    return { queued, already };
  }

  async resolveHandle(handle) {
    const h = String(handle).replace(/^@/, "");
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "id");
    url.searchParams.set("forHandle", h);
    url.searchParams.set("key", this.youtubeKey);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok) {
      const msg = JSON.stringify(data).slice(0, 200);
      if (/quotaExceeded|dailyLimitExceeded/i.test(msg)) {
        throw new Error("YouTube quota exhausted");
      }
      throw new Error(`resolve ${h}: ${msg}`);
    }
    return data.items?.[0]?.id || null;
  }

  async youtubeChannelsList(ids) {
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "snippet,statistics,brandingSettings");
    url.searchParams.set("id", ids.join(","));
    url.searchParams.set("key", this.youtubeKey);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok) {
      const msg = JSON.stringify(data).slice(0, 200);
      if (/quotaExceeded|dailyLimitExceeded/i.test(msg)) {
        throw new Error("YouTube quota exhausted");
      }
      throw new Error(`channels.list: ${msg}`);
    }
    return data.items || [];
  }

  async runImportSeeds() {
    const claim = await this.api("/api/worker/seeds/claim", "POST", {
      limit: this.seedLimit,
    });
    const seeds = claim.seeds || [];
    this.bump({ seedsClaimed: this.stats.seedsClaimed + seeds.length });
    if (seeds.length === 0) {
      this.log("No available seeds in shared pool right now.");
      this.log("  (Import needs list URLs in the bank — enrich still runs next.)");
      return 0;
    }
    this.log(`Claimed ${seeds.length} unique seed URL(s)`);

    const completions = [];
    let totalQueued = 0;

    for (const seed of seeds) {
      if (this.stopping) break;
      try {
        this.log(`Import: ${seed.title || seed.url}`);
        const html = await this.fetchPage(seed.url);
        const channels = extractYouTubeChannels(html);
        this.log(`  found ${channels.length} channel link(s)`);
        if (channels.length > 0) {
          const { queued, already } = await this.lightSave(channels);
          totalQueued += queued;
          this.bump({
            channelsQueued: this.stats.channelsQueued + queued,
          });
          this.log(`  queued=${queued} already=${already}`);
        }
        completions.push({ id: seed.id, status: "done" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`  fail: ${msg}`);
        completions.push({ id: seed.id, status: "failed", error: msg });
      }
    }

    if (completions.length) {
      await this.api("/api/worker/seeds/complete", "POST", {
        items: completions,
      });
    }
    return totalQueued;
  }

  async runEnrich() {
    if (!this.youtubeKey) {
      this.log("No YouTube API key — skipping enrich.");
      return { claimed: 0, imported: 0 };
    }

    const claim = await this.api("/api/worker/pending/claim", "POST", {
      limit: this.enrichLimit,
    });
    const pending = claim.pending || [];
    if (pending.length === 0) {
      this.log("No unclaimed pending channels to enrich.");
      return { claimed: 0, imported: 0 };
    }
    this.log(`Claimed ${pending.length} pending row(s) for enrich`);

    const pendingIdToChannelId = new Map();
    const results = [];
    const reasonCounts = {};

    function pushResult(row) {
      results.push(row);
      const key = row.reason || row.status || "ok";
      reasonCounts[key] = (reasonCounts[key] || 0) + 1;
    }

    function handleFromUrl(url) {
      try {
        const u = new URL(url);
        const m = u.pathname.match(/^\/@([^/]+)/);
        return m ? `@${m[1]}` : null;
      } catch {
        return null;
      }
    }

    function channelIdFromUrl(url) {
      try {
        const m = new URL(url).pathname.match(/^\/channel\/(UC[\w-]{22})/i);
        return m ? m[1] : null;
      } catch {
        return null;
      }
    }

    function looksLikeJunkHandle(handle) {
      if (!handle) return false;
      const h = handle.replace(/^@/, "");
      if (h.length < 3 || h.length > 30) return true;
      if (h.startsWith("-") || h.startsWith(".") || h.startsWith("_")) return true;
      if (/\.(com|org|net|io|co|ca|ph|uk|in|au|tv|me|app|dev)$/i.test(h)) return true;
      // CSS at-rules scraped from stylesheets (e.g. @font-face, @-moz-document)
      const css = /^(?:-?(?:moz|webkit|ms|o)-)?(?:font-face|keyframes|media|supports|import|charset|namespace|document|page|layer|container|property)$/i;
      if (css.test(h)) return true;
      if (/^(?:webkit|moz|ms|o)-/i.test(h)) return true;
      return false;
    }

    for (const row of pending) {
      if (this.stopping) break;
      try {
        let cid = row.channel_id || channelIdFromUrl(row.url);
        let handle = row.handle || handleFromUrl(row.url);

        if (cid && !/^UC[\w-]{22}$/i.test(cid)) {
          pushResult({
            pending_id: row.id,
            status: "failed",
            reason: "invalid channel id",
          });
          continue;
        }
        if (!cid && looksLikeJunkHandle(handle)) {
          pushResult({
            pending_id: row.id,
            status: "failed",
            reason: "junk handle (looks like website domain)",
          });
          continue;
        }
        if (!cid && handle) {
          cid = await this.resolveHandle(handle);
        }
        if (!cid) {
          pushResult({
            pending_id: row.id,
            status: "failed",
            reason: "could not resolve",
          });
          continue;
        }
        pendingIdToChannelId.set(row.id, cid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("quota")) throw err;
        pushResult({ pending_id: row.id, status: "failed", reason: msg });
      }
    }

    const ids = Array.from(new Set(pendingIdToChannelId.values()));
    const details = new Map();
    for (let i = 0; i < ids.length; i += 50) {
      if (this.stopping) break;
      const batch = ids.slice(i, i + 50);
      const items = await this.youtubeChannelsList(batch);
      for (const item of items) {
        details.set(item.id, mapYtChannel(item));
      }
    }

    for (const [pendingId, channelId] of pendingIdToChannelId) {
      const mapped = details.get(channelId);
      if (!mapped) {
        pushResult({
          pending_id: pendingId,
          status: "failed",
          reason: "not found on YouTube",
        });
        continue;
      }
      const country = (mapped.country || "").toUpperCase();
      const subs = mapped.subscriber_count || 0;
      if (this.usaOnly && country && country !== "US") {
        pushResult({
          pending_id: pendingId,
          status: "rejected",
          reason: `non-USA (${country})`,
        });
        continue;
      }
      if (this.minSubs > 0 && subs < this.minSubs) {
        pushResult({
          pending_id: pendingId,
          status: "rejected",
          reason: `below min subs (${subs})`,
        });
        continue;
      }

      if (!mapped.email && mapped.instagram) {
        try {
          this.bump({
            instagramTried: this.stats.instagramTried + 1,
          });
          const igEmail = await findEmailFromInstagram(mapped.instagram);
          if (igEmail) {
            mapped.email = igEmail;
            this.bump({
              instagramEmails: this.stats.instagramEmails + 1,
            });
            this.log(
              `  ✉ Instagram bio: ${mapped.title} → ${igEmail}`
            );
          }
        } catch {
          /* login wall / blocked — skip */
        }
      }

      pushResult({
        pending_id: pendingId,
        status: "enriched",
        channel: mapped,
      });
    }

    if (results.length) {
      const data = await this.api("/api/worker/pending/enrich", "POST", {
        results,
      });
      const imported = Number(data.imported || 0);
      this.bump({
        enriched: this.stats.enriched + imported,
        rejected: this.stats.rejected + Number(data.rejected || 0),
      });
      this.log(
        `Enrich done: imported=${data.imported} rejected=${data.rejected} failed=${data.failed}`
      );
      const top = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, v]) => `${k}=${v}`)
        .join(" · ");
      if (top) this.log(`  reasons: ${top}`);
      return { claimed: pending.length, imported };
    }
    return { claimed: pending.length, imported: 0 };
  }

  async runOneCycle() {
    this.bump({ cycles: this.stats.cycles + 1 });
    this.log(`── Cycle ${this.stats.cycles}`);

    // Priority: enrich ALL pending into channels before scraping more lists
    let quotaBlocked = false;
    let pendingEmpty = false;
    let enrichPasses = 0;
    const maxEnrichPasses = 25; // ~150 * 25 = safety cap per cycle

    while (!this.stopping && !quotaBlocked && enrichPasses < maxEnrichPasses) {
      enrichPasses++;
      try {
        const { claimed, imported } = await this.runEnrich();
        if (claimed === 0) {
          pendingEmpty = true;
          break;
        }
        this.log(
          `Enrich-first: ${imported} → channels (claimed ${claimed}). Scraping paused until pending is clear.`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(msg);
        if (/quota/i.test(msg)) {
          quotaBlocked = true;
          this.log(
            "YouTube quota exhausted — skip scraping too (pending must drain first when quota resets)."
          );
        }
        break;
      }
    }

    if (this.stopping || quotaBlocked) return;

    if (pendingEmpty) {
      this.log("Pending empty — scraping seed lists for new channels…");
      await this.runImportSeeds();
    } else {
      this.log(
        "Pending still remaining — skipping seed scrapes this cycle (enrich first)."
      );
    }
  }

  async runLoop(opts = {}) {
    this.stopping = false;
    const sleepSec = opts.sleepSec ?? 8;
    while (!this.stopping) {
      try {
        await this.runOneCycle();
      } catch (err) {
        this.log(err instanceof Error ? err.message : String(err));
      }
      if (this.stopping) break;
      this.log(`Sleep ${sleepSec}s…`);
      await new Promise((r) => {
        const t = setTimeout(r, sleepSec * 1000);
        const iv = setInterval(() => {
          if (this.stopping) {
            clearTimeout(t);
            clearInterval(iv);
            r();
          }
        }, 500);
        setTimeout(() => clearInterval(iv), sleepSec * 1000 + 10);
      });
    }
    this.log("Stopped.");
  }
}

module.exports = { ContributeEngine };
