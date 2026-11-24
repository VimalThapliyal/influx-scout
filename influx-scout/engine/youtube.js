/**
 * YouTube Data API helpers for Scout (main process).
 */
const BASE = "https://www.googleapis.com/youtube/v3";

class QuotaError extends Error {
  constructor(msg, kind = "units") {
    super(msg);
    this.name = "QuotaError";
    /** @type {'units'|'search'} */
    this.kind = kind;
  }
}

async function youtubeGet(apiKey, path, params) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("key", apiKey);
  const res = await fetch(url);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.error?.message || text.slice(0, 200);
    const isQuota =
      (res.status === 403 || res.status === 429) &&
      /quota|dailyLimit|Search Queries|Queries per day|rateLimitExceeded/i.test(
        msg
      );
    if (isQuota) {
      const kind = /Search Quer/i.test(msg) ? "search" : "units";
      throw new QuotaError(msg, kind);
    }
    throw new Error(`YouTube ${path} ${res.status}: ${msg}`);
  }
  return body;
}

function publishedAfter(window) {
  if (window === "any") return null;
  const days = window === "week" ? 7 : 30;
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Recent videos → unique channel IDs */
async function searchRecentVideoChannels(apiKey, query, opts = {}) {
  const maxResults = Math.min(opts.maxResults || 25, 50);
  const params = {
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(maxResults),
    order: "date",
    regionCode: opts.regionCode || "US",
    relevanceLanguage: "en",
  };
  const after = publishedAfter(opts.window || "month");
  if (after) params.publishedAfter = after;
  if (opts.pageToken) params.pageToken = opts.pageToken;

  const data = await youtubeGet(apiKey, "search", params);
  const channelIds = [];
  const seen = new Set();
  const videoIds = [];
  for (const item of data.items || []) {
    const cid = item.snippet?.channelId;
    const vid = item.id?.videoId;
    if (vid) videoIds.push(vid);
    if (cid && !seen.has(cid)) {
      seen.add(cid);
      channelIds.push(cid);
    }
  }
  return {
    channelIds,
    videoIds,
    nextPageToken: data.nextPageToken || null,
    totalResults: data.pageInfo?.totalResults || 0,
  };
}

async function getChannelDetails(apiKey, channelIds) {
  const results = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const data = await youtubeGet(apiKey, "channels", {
      part: "snippet,statistics,brandingSettings,contentDetails",
      id: batch.join(","),
    });
    results.push(...(data.items || []));
  }
  return results;
}

/** UC… → UU… uploads playlist (free client-side; avoids extra channels.list). */
function uploadsPlaylistIdFromChannelId(channelId, fromApi) {
  if (fromApi) return fromApi;
  if (channelId && String(channelId).startsWith("UC") && channelId.length > 2) {
    return `UU${channelId.slice(2)}`;
  }
  return null;
}

/** playlistItems.list — 1 unit; returns up to max video IDs (no stats yet). */
async function getUploadVideoIds(apiKey, uploadsPlaylistId, max = 5) {
  if (!uploadsPlaylistId) return [];
  const playlist = await youtubeGet(apiKey, "playlistItems", {
    part: "contentDetails,snippet",
    playlistId: uploadsPlaylistId,
    maxResults: String(max),
  });
  return (playlist.items || [])
    .map((i) => i.contentDetails?.videoId || i.snippet?.resourceId?.videoId)
    .filter(Boolean);
}

/** videos.list batched — 1 unit per ≤50 IDs. Returns Map<videoId, snapshot>. */
async function getVideosByIds(apiKey, videoIds) {
  const map = new Map();
  const unique = [...new Set((videoIds || []).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const videos = await youtubeGet(apiKey, "videos", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
    });
    for (const v of videos.items || []) {
      map.set(v.id, {
        id: v.id,
        title: v.snippet?.title || "Untitled",
        description: v.snippet?.description || null,
        tags: v.snippet?.tags || null,
        view_count: parseInt(v.statistics?.viewCount || "0", 10),
        like_count: v.statistics?.likeCount
          ? parseInt(v.statistics.likeCount, 10)
          : null,
        comment_count: v.statistics?.commentCount
          ? parseInt(v.statistics.commentCount, 10)
          : null,
        published_at: v.snippet?.publishedAt || "",
        duration: v.contentDetails?.duration || null,
      });
    }
  }
  return map;
}

async function getRecentVideos(apiKey, channelId, uploadsPlaylistId, max = 5) {
  const uploadsId = uploadsPlaylistIdFromChannelId(
    channelId,
    uploadsPlaylistId
  );
  if (!uploadsId) return [];
  const ids = await getUploadVideoIds(apiKey, uploadsId, max);
  if (!ids.length) return [];
  const map = await getVideosByIds(apiKey, ids);
  return ids.map((id) => map.get(id)).filter(Boolean);
}

async function getCommentAuthorIds(apiKey, videoId, maxResults = 15) {
  const data = await youtubeGet(apiKey, "commentThreads", {
    part: "snippet",
    videoId,
    maxResults: String(Math.min(maxResults, 100)),
    order: "relevance",
    textFormat: "plainText",
  });
  const ids = [];
  const seen = new Set();
  for (const item of data.items || []) {
    const cid =
      item.snippet?.topLevelComment?.snippet?.authorChannelId?.value;
    if (cid && !seen.has(cid)) {
      seen.add(cid);
      ids.push(cid);
    }
  }
  return ids;
}

function mapChannel(item) {
  const subs = item.statistics?.subscriberCount
    ? parseInt(item.statistics.subscriberCount, 10)
    : null;
  const views = item.statistics?.viewCount
    ? parseInt(item.statistics.viewCount, 10)
    : 0;
  const videos = item.statistics?.videoCount
    ? parseInt(item.statistics.videoCount, 10)
    : 0;
  const custom = item.snippet?.customUrl;
  const handle = custom
    ? custom.startsWith("@")
      ? custom
      : `@${custom}`
    : null;
  let tier = null;
  if (subs != null) {
    if (subs >= 1e6) tier = "mega";
    else if (subs >= 5e5) tier = "macro";
    else if (subs >= 1e5) tier = "mid";
    else if (subs >= 1e4) tier = "micro";
    else tier = "nano";
  }
  return {
    id: item.id,
    handle,
    title: item.snippet?.title || "Unknown",
    description: item.snippet?.description || null,
    thumbnail_url:
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      null,
    subscriber_count: subs,
    view_count: views,
    video_count: videos,
    country: item.snippet?.country || null,
    published_at: item.snippet?.publishedAt || null,
    tier,
    data_source: "api",
    uploadsPlaylistId:
      item.contentDetails?.relatedPlaylists?.uploads || null,
  };
}

const NICHE_QUERIES = {
  fitness: ["fitness workout usa", "home workout", "gym vlog"],
  gaming: ["gaming usa", "lets play", "twitch streamer"],
  beauty: ["makeup tutorial", "skincare routine", "beauty haul"],
  fashion: ["outfit ideas", "fashion haul", "street style"],
  finance: ["personal finance", "investing for beginners", "money tips"],
  tech: ["tech review", "coding tutorial", "gadgets"],
  food: ["cooking recipe", "food vlog", "meal prep"],
  travel: ["travel vlog usa", "road trip", "city guide"],
  parenting: ["mom vlog", "parenting tips", "family vlog"],
  education: ["study with me", "learn coding", "explainer"],
  pets: ["dog training", "cat videos", "pet care"],
  diy: ["diy home", "crafts tutorial", "woodworking"],
};

module.exports = {
  QuotaError,
  searchRecentVideoChannels,
  getChannelDetails,
  getRecentVideos,
  getUploadVideoIds,
  getVideosByIds,
  uploadsPlaylistIdFromChannelId,
  getCommentAuthorIds,
  mapChannel,
  NICHE_QUERIES,
  publishedAfter,
};
