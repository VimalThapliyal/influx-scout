const DEFAULT_API = "https://influencer-platform-mu.vercel.app";
const SAVE_LABEL = "Save to Influx";
const SAVED_LABEL = "Already saved";
const TOO_SMALL_LABEL = "Under min subs";
const QUOTA_STOP_MESSAGE =
  "YouTube quota used up — resets ~12:30 PM IST (midnight Pacific).";

/** Rotate only after scrolling this many times on a saturated keyword. */
const DEEP_SCROLL_BEFORE_ROTATE = 4;
const MAX_SCROLLS_PER_KEYWORD = 14;
const SCROLL_PX = 900;
const SATURATION_SAVED_RATIO = 0.5;
const SATURATION_MIN_ROWS = 5;

/** @type {Map<string, boolean>} */
const savedCache = new Map();

/** @type {Set<string>} */
const pendingChecks = new Set();
let checkTimer = null;

// Mutable state — must be declared before tick()/injectors run
let autoSaveTimer = null;
let autoSaveRunning = false;
let autoSaveDelayMs = 1000;
let autoSaveIdle = 0;
let autoSaveClicks = 0;
let autoSaveSaved = 0;
let autoSaveTooSmall = 0;
let autoSaveRotateEnabled = true;
let autoSaveLastKeyword = "";
let autoSaveRotations = 0;
let quotaStopped = false;
let autoSaveScrollDepth = 0;
let autoSaveFilterIndex = 0;
let autoSaveBaseKeyword = "";
let autoSaveKeywordSessionSaved = 0;
let relatedCrawlRunning = false;
let relatedCrawlQueued = 0;
let relatedCrawlSaved = 0;

function normalizeUrl(url) {
  return url.split(/[?#]/)[0].replace(/\/$/, "");
}

function parseSubscriberCount(text) {
  if (!text) return null;
  const m = text.match(/([\d,.]+)\s*([KMBkmb])?\s*subscribers/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const suffix = (m[2] || "").toUpperCase();
  if (suffix === "K") n *= 1000;
  else if (suffix === "M") n *= 1_000_000;
  else if (suffix === "B") n *= 1_000_000_000;
  return Math.round(n);
}

function subscriberCountFromRow(row) {
  const el = row.querySelector("#subscriber-count, yt-formatted-string#subscriber-count");
  if (el?.textContent) return parseSubscriberCount(el.textContent);
  return parseSubscriberCount(row.textContent ?? "");
}

function subscriberCountFromPage() {
  const el = document.querySelector(
    "#owner-sub-count, yt-formatted-string#owner-sub-count, #subscriber-count"
  );
  if (el?.textContent) return parseSubscriberCount(el.textContent);
  return parseSubscriberCount(document.body?.innerText?.slice(0, 4000) ?? "");
}

async function getSettings() {
  const defaults = {
    apiUrl: DEFAULT_API,
    workerKey: "",
    usaOnly: true,
    minSubscribers: 1000,
    lightSave: true,
    relatedCrawl: true,
  };

  let fromDom = {};
  try {
    const raw = document.documentElement.getAttribute("data-influx-settings");
    if (raw) fromDom = JSON.parse(raw);
  } catch {
    fromDom = {};
  }

  let fromChrome = {};
  try {
    fromChrome = await chrome.storage.sync.get(defaults);
  } catch {
    fromChrome = {};
  }

  // Electron Contributor app bridge (most reliable while the app is open)
  let fromApp = {};
  try {
    const res = await fetch("http://127.0.0.1:17341/influx-settings", {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data.workerKey) {
        fromApp = {
          apiUrl: data.apiUrl || DEFAULT_API,
          workerKey: data.workerKey,
          usaOnly: data.usaOnly !== false,
          minSubscribers:
            typeof data.minSubscribers === "number"
              ? data.minSubscribers
              : 1000,
          lightSave: data.lightSave !== false,
          relatedCrawl: data.relatedCrawl !== false,
        };
        // Keep chrome.storage in sync for later navigations
        try {
          await chrome.storage.sync.set(fromApp);
        } catch {
          /* ignore */
        }
        try {
          document.documentElement.setAttribute(
            "data-influx-settings",
            JSON.stringify(fromApp)
          );
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* app not running */
  }

  const merged = { ...defaults, ...fromChrome };
  if (fromDom.workerKey) Object.assign(merged, fromDom);
  if (fromApp.workerKey) Object.assign(merged, fromApp);
  return merged;
}

function channelIdFromHref(href) {
  if (!href) return null;
  const m = href.match(/\/channel\/(UC[\w-]{20,})/i);
  return m?.[1] ?? null;
}

function handleFromHref(href) {
  if (!href) return null;
  const m = href.match(/\/@([^/?#]+)/);
  return m?.[1] ? `@${decodeURIComponent(m[1])}` : null;
}

function titleFromRow(row) {
  const el = row?.querySelector(
    "#channel-title, #text.ytd-channel-name, yt-formatted-string#text, #channel-name yt-formatted-string"
  );
  const t = el?.textContent?.trim();
  return t || null;
}

function thumbnailFromRow(row) {
  const img = row?.querySelector("#avatar img, #img, img#img, yt-img-shadow img");
  return img?.src || null;
}

function channelIdFromRow(row) {
  if (!row) return null;
  const links = row.querySelectorAll("a[href*='/channel/'], a[href*='/@']");
  for (const a of links) {
    const id = channelIdFromHref(a.href);
    if (id) return id;
  }
  // yt-endpoint / data attributes
  const raw =
    row.getAttribute("data-channel-id") ||
    row.querySelector("[data-channel-id]")?.getAttribute("data-channel-id");
  if (raw && /^UC[\w-]{20,}$/i.test(raw)) return raw;
  return null;
}

function scrapeChannelPayload(url, row) {
  const normalized = normalizeUrl(url);
  const fromUrlId = channelIdFromHref(normalized);
  const fromUrlHandle = handleFromHref(normalized);
  const channelId = channelIdFromRow(row) || fromUrlId;
  const handle =
    fromUrlHandle ||
    (row
      ? handleFromHref(
          row.querySelector("a[href*='/@']")?.href || ""
        )
      : null);
  const title =
    titleFromRow(row) ||
    (location.pathname.startsWith("/@") || location.pathname.startsWith("/channel/")
      ? document.querySelector("ytd-channel-name yt-formatted-string, #channel-name yt-formatted-string, meta[property='og:title']")
          ?.getAttribute?.("content") ||
        document.querySelector("ytd-channel-name yt-formatted-string, #channel-name yt-formatted-string")
          ?.textContent?.trim() ||
        null
      : null);
  const subscriber_count = row
    ? subscriberCountFromRow(row)
    : subscriberCountFromPage();
  const thumbnail_url =
    thumbnailFromRow(row) ||
    document.querySelector("meta[property='og:image']")?.getAttribute("content") ||
    null;

  return {
    url: normalized,
    channel_id: channelId,
    handle,
    title,
    subscriber_count,
    thumbnail_url,
  };
}

function applyTooSmallButton(btn) {
  const firstMark = btn.dataset.influxTooSmall !== "1";
  btn.textContent = TOO_SMALL_LABEL;
  btn.disabled = true;
  btn.dataset.influxTooSmall = "1";
  btn.classList.add("influx-too-small");
  btn.classList.remove("influx-ok", "influx-err", "influx-saved");
  if (autoSaveRunning && firstMark) {
    autoSaveTooSmall++;
    updateAutoSaveBadge();
    syncAutoSaveToBackground();
  }
}

function pageChannelUrl() {
  const path = location.pathname;
  if (path.startsWith("/@")) {
    return location.origin + path.split("/").slice(0, 2).join("/");
  }
  if (path.startsWith("/channel/")) {
    return location.origin + path.split("/").slice(0, 2).join("/");
  }
  return null;
}

function channelUrlFromElement(el) {
  const channelCard = el.closest(
    "ytd-channel-renderer, ytd-grid-channel-renderer, ytd-mini-channel-renderer"
  );
  if (channelCard) {
    const link = channelCard.querySelector(
      "a#main-link, a#channel-info, a.channel-link, a.yt-simple-endpoint[href*='/@'], a.yt-simple-endpoint[href*='/channel/']"
    );
    if (link?.href) {
      const u = normalizeUrl(link.href);
      if (u.includes("/channel/") || u.includes("/@")) return u;
    }
  }

  const link = el.closest("ytd-channel-renderer")?.querySelector("a#main-link");
  if (link?.href) return normalizeUrl(link.href);

  const owner = el.closest(
    "ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer"
  )?.querySelector(
    "ytd-channel-name a, #channel-name a, a.yt-simple-endpoint[href*='/@'], a.yt-simple-endpoint[href*='/channel/']"
  );
  if (owner?.href) {
    const u = normalizeUrl(owner.href);
    if (u.includes("/channel/") || u.includes("/@")) return u;
  }
  return null;
}

function isVideoSearchResultsPage() {
  if (autoSaveRunning && influxIsVideoSearchMode(autoSaveFilterIndex)) {
    return true;
  }
  try {
    const sp = decodeURIComponent(
      new URLSearchParams(location.search).get("sp") || ""
    );
    return sp.includes("EgIQAQ");
  } catch {
    return false;
  }
}

function applySavedButton(btn, saved) {
  if (saved) {
    btn.textContent = SAVED_LABEL;
    btn.disabled = true;
    btn.dataset.influxSaved = "1";
    btn.classList.add("influx-saved");
    btn.classList.remove("influx-ok", "influx-err");
    delete btn.dataset.influxAutoQueued;
  } else if (btn.dataset.influxSaved !== "1") {
    btn.textContent = SAVE_LABEL;
    btn.disabled = false;
    btn.classList.remove("influx-saved");
    delete btn.dataset.influxAutoQueued;
  }
}

function markUrlSaved(url, options = {}) {
  const key = normalizeUrl(url);
  const wasNew = savedCache.get(key) !== true;
  savedCache.set(key, true);
  influxMarkChannelSeen(key).catch(() => {});
  if (autoSaveRunning && wasNew && options.count !== false) {
    autoSaveSaved++;
    updateAutoSaveBadge();
    syncAutoSaveToBackground();
  }
  document.querySelectorAll(`[data-influx-url="${CSS.escape(key)}"]`).forEach((btn) => {
    applySavedButton(btn, true);
  });
  const floatBtn = document.getElementById("influx-float-save");
  if (floatBtn?.dataset.influxUrl === key) {
    applySavedButton(floatBtn, true);
  }
}

async function checkUrls(urls) {
  const unique = [...new Set(urls.map(normalizeUrl))].filter(
    (u) => savedCache.get(u) !== true
  );
  if (unique.length === 0) return;

  const { apiUrl, workerKey } = await getSettings();
  if (!workerKey) return;

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/worker/check`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls: unique }),
    });
    const data = await res.json();
    if (!res.ok || !data.statuses) return;

    for (const [url, status] of Object.entries(data.statuses)) {
      const key = normalizeUrl(url);
      if (status.saved) {
        savedCache.set(key, true);
        influxMarkChannelSeen(key).catch(() => {});
        document
          .querySelectorAll(`[data-influx-url="${CSS.escape(key)}"]`)
          .forEach((btn) => applySavedButton(btn, true));
      } else {
        savedCache.set(key, false);
      }
    }
  } catch {
    /* ignore — buttons stay as Save */
  }
}

function queueUrlCheck(url) {
  pendingChecks.add(normalizeUrl(url));
  if (checkTimer) clearTimeout(checkTimer);
  checkTimer = setTimeout(() => {
    const batch = [...pendingChecks];
    pendingChecks.clear();
    checkTimer = null;
    checkUrls(batch);
  }, 400);
}

async function submitUrl(url, row) {
  const { apiUrl, workerKey, usaOnly, minSubscribers, lightSave } =
    await getSettings();
  if (!workerKey) {
    throw new Error("Save worker key in the Influx Contributor app (Dashboard tab)");
  }

  const payload = scrapeChannelPayload(url, row);
  const useLight = lightSave !== false;

  const body = useLight
    ? {
        mode: "light",
        channels: [payload],
        usa_only: usaOnly,
        min_subscribers: minSubscribers > 0 ? minSubscribers : 0,
      }
    : {
        mode: "full",
        urls: [payload.url],
        usa_only: usaOnly,
        min_subscribers: minSubscribers > 0 ? minSubscribers : 0,
      };

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/worker/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    if (isQuotaExceededResponse(res, data)) {
      await stopForQuotaExceeded(apiUrl);
      throw new Error(QUOTA_STOP_MESSAGE);
    }
    throw new Error(data.error || "Save failed");
  }
  if (data.imported > 0 || data.already_saved > 0 || data.already_pending > 0) {
    const shouldCount =
      data.mode === "light" ? Number(data.queued || 0) > 0 : data.imported > 0;
    markUrlSaved(url, { count: shouldCount });
    if (shouldCount) {
      enqueueRelatedCrawl(url).catch(() => {});
    }
  }
  return data;
}

async function submitChannelBatch(payloads) {
  const { apiUrl, workerKey, usaOnly, minSubscribers, lightSave } =
    await getSettings();
  if (!workerKey) throw new Error("Save worker key in the Influx Contributor app (Dashboard tab)");
  if (!payloads.length) {
    return { queued: 0, already_saved: 0, already_pending: 0, imported: 0 };
  }

  const useLight = lightSave !== false;
  const body = useLight
    ? {
        mode: "light",
        channels: payloads.slice(0, 50),
        usa_only: usaOnly,
        min_subscribers: minSubscribers > 0 ? minSubscribers : 0,
      }
    : {
        mode: "full",
        urls: payloads.slice(0, 50).map((p) => p.url),
        usa_only: usaOnly,
        min_subscribers: minSubscribers > 0 ? minSubscribers : 0,
      };

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/worker/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Batch save failed");
  return data;
}

function attachSaveHandler(btn, url, options = {}) {
  const normalized = normalizeUrl(url);
  btn.dataset.influxUrl = normalized;

  if (btn.dataset.influxBound === "1") {
    if (savedCache.get(normalized) === true) applySavedButton(btn, true);
    else if (options.tooSmall) applyTooSmallButton(btn);
    else queueUrlCheck(normalized);
    return;
  }
  btn.dataset.influxBound = "1";

  if (savedCache.get(normalized) === true) {
    applySavedButton(btn, true);
    return;
  }

  if (options.tooSmall) {
    applyTooSmallButton(btn);
    return;
  }

  queueUrlCheck(normalized);

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.disabled || btn.dataset.influxSaved === "1" || btn.dataset.influxTooSmall === "1") return;

    btn.disabled = true;
    btn.textContent = "Saving…";
    btn.classList.remove("influx-err");

    try {
      const row =
        options.row ||
        btn.closest(
          "ytd-channel-renderer, ytd-video-renderer, ytd-grid-video-renderer"
        );
      const data = await submitUrl(normalized, row);
      if (data.imported > 0 || data.already_saved > 0 || data.already_pending > 0) {
        applySavedButton(btn, true);
      } else if (data.skipped_below_min_subs > 0) {
        applyTooSmallButton(btn);
      } else if (data.mode === "light") {
        btn.textContent = "Not queued";
        btn.classList.add("influx-err");
        btn.disabled = false;
        setTimeout(() => {
          if (btn.dataset.influxSaved !== "1") {
            btn.textContent = SAVE_LABEL;
            btn.classList.remove("influx-err");
          }
        }, 3000);
      } else {
        btn.textContent = "Skipped (non-USA?)";
        btn.classList.add("influx-err");
        btn.disabled = false;
        setTimeout(() => {
          if (btn.dataset.influxSaved !== "1") {
            btn.textContent = SAVE_LABEL;
            btn.classList.remove("influx-err");
          }
        }, 3000);
      }
    } catch (err) {
      const msg = err.message || "Error";
      const isQuota =
        msg === QUOTA_STOP_MESSAGE || msg.toLowerCase().includes("quota");
      if (isQuota) {
        btn.textContent = "Quota — try tomorrow";
        btn.disabled = true;
        btn.classList.add("influx-err");
        return;
      }
      btn.textContent = msg.slice(0, 28);
      btn.classList.add("influx-err");
      btn.disabled = false;
      setTimeout(() => {
        if (btn.dataset.influxSaved !== "1") {
          btn.textContent = SAVE_LABEL;
          btn.classList.remove("influx-err");
        }
      }, 3000);
    }
  });
}

function createSaveButton(url, options = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "influx-save-btn";
  btn.textContent = SAVE_LABEL;
  attachSaveHandler(btn, url, options);
  return btn;
}

async function injectChannelPageButton() {
  const url = pageChannelUrl();
  if (!url) {
    document.getElementById("influx-float-stack")?.remove();
    return;
  }

  const { minSubscribers } = await getSettings();
  const subs = subscriberCountFromPage();
  const tooSmall =
    minSubscribers > 0 && subs !== null && subs < minSubscribers;

  let stack = document.getElementById("influx-float-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "influx-float-stack";
    stack.className = "influx-float-stack";
    document.body.appendChild(stack);
  }

  let btn = document.getElementById("influx-float-save");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "influx-float-save";
    btn.className = "influx-float-btn";
    btn.textContent = SAVE_LABEL;
    stack.appendChild(btn);
  }
  if (btn.dataset.influxUrl !== normalizeUrl(url)) {
    btn.dataset.influxBound = "";
    btn.dataset.influxSaved = "";
    btn.dataset.influxTooSmall = "";
    btn.classList.remove("influx-saved", "influx-ok", "influx-err", "influx-too-small");
    btn.textContent = SAVE_LABEL;
    btn.disabled = false;
  }
  attachSaveHandler(btn, url, { tooSmall });

  let crawlBtn = document.getElementById("influx-float-related");
  if (!crawlBtn) {
    crawlBtn = document.createElement("button");
    crawlBtn.id = "influx-float-related";
    crawlBtn.className = "influx-float-btn influx-float-related";
    crawlBtn.type = "button";
    crawlBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startRelatedCrawlForCurrentChannel();
    });
    stack.appendChild(crawlBtn);
  }
  crawlBtn.textContent = isChannelsTab()
    ? relatedCrawlRunning
      ? "Crawling…"
      : "Crawl related now"
    : "Open related & crawl";
  crawlBtn.disabled = relatedCrawlRunning;

  injectRelatedChannelButtons();
}

function isChannelsTab() {
  return /\/channels\/?$/i.test(location.pathname);
}

function relatedChannelsTabUrl(channelUrl) {
  const base = normalizeUrl(channelUrl);
  if (/\/channels$/i.test(base)) return base;
  return `${base}/channels`;
}

function channelRootFromUrl(url) {
  const u = normalizeUrl(url);
  return u.replace(/\/channels$/i, "");
}

/** Collect related/featured channel cards on a channel page (esp. /channels tab). */
function collectRelatedChannelCards() {
  const currentRoot = pageChannelUrl()
    ? channelRootFromUrl(pageChannelUrl())
    : null;
  const cards = [];
  const seen = new Set();

  const add = (url, row) => {
    if (!url) return;
    const normalized = normalizeUrl(url);
    const root = channelRootFromUrl(normalized);
    if (currentRoot && root === currentRoot) return;
    if (!root.includes("/@") && !root.includes("/channel/")) return;
    if (seen.has(root)) return;
    seen.add(root);
    cards.push({ url: root, row });
  };

  document
    .querySelectorAll(
      "ytd-grid-channel-renderer, ytd-channel-renderer, ytd-mini-channel-renderer"
    )
    .forEach((row) => {
      add(channelUrlFromElement(row), row);
    });

  // Featured shelves / about links
  document
    .querySelectorAll(
      "#contents a[href*='/@'], #contents a[href*='/channel/UC'], ytd-browse a[href*='/@'], ytd-browse a[href*='/channel/UC']"
    )
    .forEach((a) => {
      const href = a.getAttribute("href") || "";
      // Channel root only — skip videos, tabs, playlists
      if (
        !/^\/@[^/?#]+\/?$/.test(href) &&
        !/^\/channel\/UC[\w-]+\/?$/.test(href)
      ) {
        return;
      }
      try {
        const abs = new URL(href, location.origin).href;
        add(
          abs,
          a.closest(
            "ytd-grid-channel-renderer, ytd-channel-renderer, ytd-mini-channel-renderer"
          ) || a.parentElement
        );
      } catch {
        /* ignore */
      }
    });

  return cards;
}

function injectRelatedChannelButtons() {
  if (!pageChannelUrl()) return;

  collectRelatedChannelCards().forEach(({ url, row }) => {
    if (!row || row.nodeType !== 1) return;
    const existing = row.querySelector?.(".influx-save-btn");
    if (existing) {
      if (existing.dataset.influxUrl !== normalizeUrl(url)) {
        existing.replaceWith(createSaveButton(url, { tooSmall: false, row }));
      }
      return;
    }
    const host =
      row.querySelector?.("#info, #details, #meta, #channel-info") || row;
    if (!host?.appendChild) return;
    const btn = createSaveButton(url, { tooSmall: false, row });
    btn.title = "Light-save related channel";
    host.appendChild(btn);
  });
}

async function enqueueRelatedCrawl(seedChannelUrl) {
  const { relatedCrawl } = await getSettings();
  if (relatedCrawl === false) return;
  const tabUrl = relatedChannelsTabUrl(seedChannelUrl);
  chrome.runtime
    .sendMessage({ type: "influx-related-enqueue", url: tabUrl })
    .catch(() => {});
}

async function startRelatedCrawlForCurrentChannel() {
  const url = pageChannelUrl();
  if (!url) return;

  if (!isChannelsTab()) {
    try {
      sessionStorage.setItem("influx_related_auto", "1");
    } catch {
      /* ignore */
    }
    chrome.runtime
      .sendMessage({
        type: "influx-related-run",
        url: relatedChannelsTabUrl(url),
      })
      .catch(() => {});
    location.assign(relatedChannelsTabUrl(url));
    return;
  }

  await runRelatedCrawlOnPage();
}

function showRelatedCrawlBadge(text) {
  let badge = document.getElementById("influx-related-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "influx-related-badge";
    badge.className = "influx-auto-badge";
    document.body.appendChild(badge);
  }
  badge.textContent = text;
}

function hideRelatedCrawlBadge() {
  document.getElementById("influx-related-badge")?.remove();
}

async function runRelatedCrawlOnPage() {
  if (relatedCrawlRunning) return { queued: 0 };
  relatedCrawlRunning = true;
  relatedCrawlQueued = 0;
  relatedCrawlSaved = 0;

  try {
    sessionStorage.removeItem("influx_related_auto");
  } catch {
    /* ignore */
  }

  const crawlBtn = document.getElementById("influx-float-related");
  if (crawlBtn) {
    crawlBtn.disabled = true;
    crawlBtn.textContent = "Crawling…";
  }

  showRelatedCrawlBadge("Related crawl · waiting for page…");

  for (let w = 0; w < 15; w++) {
    const hasCards = document.querySelector(
      "ytd-grid-channel-renderer, ytd-channel-renderer, ytd-mini-channel-renderer"
    );
    const emptyText = (document.body?.innerText || "").slice(0, 8000);
    const looksEmpty =
      /doesn't feature any other channels|no channels to show|haven't featured/i.test(
        emptyText
      );
    if (hasCards || looksEmpty || w >= 8) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  try {
    const maxScrolls = 8;
    let idle = 0;

    for (let step = 0; step < maxScrolls + 4; step++) {
      injectRelatedChannelButtons();
      const cards = collectRelatedChannelCards().filter(
        ({ url }) => savedCache.get(normalizeUrl(url)) !== true
      );

      showRelatedCrawlBadge(
        `Related crawl · ${cards.length} new · ${relatedCrawlQueued} queued · scroll ${Math.min(step, maxScrolls)}/${maxScrolls}`
      );

      if (cards.length === 0) {
        idle++;
        if (idle >= 2 && step >= 1) break;
        window.scrollBy({ top: 900, behavior: "smooth" });
        await new Promise((r) => setTimeout(r, 900));
        continue;
      }

      idle = 0;
      const batch = cards.slice(0, 50).map(({ url, row }) =>
        scrapeChannelPayload(url, row)
      );

      try {
        const data = await submitChannelBatch(batch);
        const queued = Number(data.queued || 0);
        relatedCrawlQueued += queued;
        relatedCrawlSaved += queued;

        for (const { url } of cards.slice(0, 50)) {
          markUrlSaved(url, { count: false });
        }
      } catch (err) {
        console.warn("[Influx] related batch failed:", err);
        showRelatedCrawlBadge(
          `Related crawl error: ${(err.message || "failed").slice(0, 60)}`
        );
        break;
      }

      window.scrollBy({ top: 900, behavior: "smooth" });
      await new Promise((r) => setTimeout(r, 800));
    }

    showRelatedCrawlBadge(
      relatedCrawlQueued > 0
        ? `Related crawl done · ${relatedCrawlQueued} queued (0 API quota)`
        : "Related crawl done · no featured channels — skipping"
    );
    setTimeout(hideRelatedCrawlBadge, 5000);

    chrome.runtime
      .sendMessage({
        type: "influx-related-done",
        url: location.href,
        queued: relatedCrawlQueued,
      })
      .catch(() => {});

    return { queued: relatedCrawlQueued };
  } finally {
    relatedCrawlRunning = false;
    if (crawlBtn) {
      crawlBtn.disabled = false;
      crawlBtn.textContent = isChannelsTab()
        ? "Crawl related now"
        : "Open related & crawl";
    }
  }
}

function resumeAutoSaveSearchAfterRelated() {
  chrome.runtime.sendMessage({ type: "influx-auto-save-get" }, (state) => {
    if (chrome.runtime.lastError || !state?.active) return;
    const kw = state.keyword || autoSaveBaseKeyword;
    if (!kw) return;
    setTimeout(() => {
      location.assign(
        influxBuildChannelSearchUrl(kw, state.filterIndex ?? 0)
      );
    }, 1200);
  });
}

async function maybeAutoStartRelatedCrawl() {
  if (!isChannelsTab() || relatedCrawlRunning) return;

  let should = false;
  try {
    if (sessionStorage.getItem("influx_related_auto") === "1") should = true;
  } catch {
    /* ignore */
  }

  try {
    const res = await chrome.runtime.sendMessage({
      type: "influx-related-should-auto-crawl",
      url: location.href,
    });
    if (res?.should) should = true;
  } catch {
    /* ignore */
  }

  if (!should) {
    try {
      const state = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "influx-auto-save-get" }, (s) =>
          resolve(s || null)
        );
      });
      if (state?.active) should = true;
    } catch {
      /* ignore */
    }
  }

  if (!should) return;

  showRelatedCrawlBadge("Related crawl · starting…");
  await runRelatedCrawlOnPage();
  resumeAutoSaveSearchAfterRelated();
}

/** YouTube SPA navigations do not reload the content script. */
function hookYouTubeSpaNavigation() {
  const onNav = () => {
    setTimeout(() => {
      injectChannelPageButton().catch(() => {});
      maybeAutoStartRelatedCrawl().catch(() => {});
      requestAutoSaveResume();
    }, 600);
  };
  window.addEventListener("yt-navigate-finish", onNav);
  document.addEventListener("yt-navigate-finish", onNav);
  window.addEventListener("yt-page-data-updated", onNav);
}

async function injectVideoSearchButtons() {
  document.querySelectorAll("ytd-video-renderer").forEach((row) => {
    const url = channelUrlFromElement(row);
    if (!url) return;

    let btn = row.querySelector(".influx-save-btn");
    if (!btn) {
      const host =
        row.querySelector("#meta #metadata-line, #meta, #details") || row;
      btn = createSaveButton(url, { tooSmall: false, row });
      btn.title = "Save uploader channel to Influx";
      host.appendChild(btn);
    } else if (btn.dataset.influxUrl !== normalizeUrl(url)) {
      btn.replaceWith(createSaveButton(url, { tooSmall: false, row }));
    }
  });
}

async function injectSearchButtons() {
  if (isVideoSearchResultsPage()) {
    await injectVideoSearchButtons();
    return;
  }

  const { minSubscribers } = await getSettings();

  document.querySelectorAll("ytd-channel-renderer").forEach((row) => {
    const url = channelUrlFromElement(row);
    if (!url) return;

    const subs = subscriberCountFromRow(row);
    const tooSmall =
      minSubscribers > 0 && subs !== null && subs < minSubscribers;

    let btn = row.querySelector(".influx-save-btn");
    if (!btn) {
      const meta = row.querySelector("#info #channel-info, #info");
      const host = meta || row.querySelector("#info") || row;
      btn = createSaveButton(url, { tooSmall, row });
      host.appendChild(btn);
    } else if (btn.dataset.influxUrl !== normalizeUrl(url)) {
      btn.replaceWith(createSaveButton(url, { tooSmall, row }));
    } else if (tooSmall && btn.dataset.influxTooSmall !== "1" && btn.dataset.influxSaved !== "1") {
      applyTooSmallButton(btn);
    }
  });
}

function tick() {
  injectChannelPageButton();
  if (location.pathname === "/results" || location.search.includes("search_query")) {
    injectSearchButtons();
  }
}

tick();
const observer = new MutationObserver(() => tick());
observer.observe(document.body, { childList: true, subtree: true });

function isQuotaExceededResponse(res, data) {
  if (data?.quota_exceeded === true) return true;
  const err = String(data?.error || "").toLowerCase();
  return (
    err.includes("quota exceeded") ||
    err.includes("exceeded your quota") ||
    err.includes("quotaexceeded") ||
    err.includes("daily quota exhausted")
  );
}

async function confirmQuotaExceededWithServer(apiUrl) {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/health`);
    const data = await res.json();
    const q = data?.quota;
    if (q?.google_quota_exhausted === true) return true;
    const remaining = q?.remaining ?? 9999;
    const used = q?.used ?? 0;
    return remaining <= 0 || used >= (q?.limit ?? 10000);
  } catch {
    return true;
  }
}

function showQuotaStoppedBadge() {
  let badge = document.getElementById("influx-auto-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "influx-auto-badge";
    badge.className = "influx-auto-badge influx-quota-stop";
    document.body.appendChild(badge);
  }
  badge.className = "influx-auto-badge influx-quota-stop";
  badge.textContent = `${QUOTA_STOP_MESSAGE} (${autoSaveSaved} saved this run)`;
}

async function stopForQuotaExceeded(apiUrl) {
  if (quotaStopped) return;
  const confirmed = apiUrl ? await confirmQuotaExceededWithServer(apiUrl) : true;
  if (!confirmed) {
    console.warn("[Influx] Save failed but API quota is not exhausted — not stopping auto-save.");
    return;
  }
  quotaStopped = true;
  stopAutoSave();
  showQuotaStoppedBadge();
}

function resetQuotaStopped() {
  quotaStopped = false;
  const badge = document.getElementById("influx-auto-badge");
  if (badge?.classList.contains("influx-quota-stop")) badge.remove();
}

function analyzeVisibleChannelQuality(minSubscribers) {
  const rows = document.querySelectorAll("ytd-channel-renderer");
  let total = 0;
  let belowMin = 0;
  let aboveMin = 0;
  let unknown = 0;

  rows.forEach((row) => {
    const subs = subscriberCountFromRow(row);
    if (subs === null) {
      unknown++;
      return;
    }
    total++;
    if (minSubscribers > 0 && subs < minSubscribers) belowMin++;
    else aboveMin++;
  });

  const tooSmallButtons = document.querySelectorAll(
    ".influx-save-btn.influx-too-small, .influx-save-btn[data-influx-too-small='1']"
  ).length;

  return { total, belowMin, aboveMin, unknown, tooSmallButtons, rowCount: rows.length };
}

function analyzeVisibleSaturation() {
  const buttons = document.querySelectorAll(
    "ytd-channel-renderer .influx-save-btn, ytd-video-renderer .influx-save-btn"
  );
  let saved = 0;
  let tooSmall = 0;
  let clickable = 0;

  buttons.forEach((btn) => {
    if (btn.dataset.influxSaved === "1") saved++;
    else if (btn.dataset.influxTooSmall === "1") tooSmall++;
    else if (isClickableSaveButton(btn)) clickable++;
  });

  const total = buttons.length;
  const savedRatio = total > 0 ? saved / total : 0;
  const saturated =
    total >= SATURATION_MIN_ROWS && savedRatio >= SATURATION_SAVED_RATIO;
  const noNewLeft =
    total >= SATURATION_MIN_ROWS && clickable === 0 && saved + tooSmall >= total - 1;

  return { saved, tooSmall, clickable, total, savedRatio, saturated, noNewLeft };
}

function deepScrollForMore() {
  if (autoSaveScrollDepth >= MAX_SCROLLS_PER_KEYWORD) return false;
  autoSaveScrollDepth++;
  window.scrollBy({ top: SCROLL_PX, behavior: "smooth" });
  return true;
}

function getRotateReason(minSubscribers, sat) {
  if (!autoSaveRotateEnabled) return null;

  const stats = analyzeVisibleChannelQuality(minSubscribers);
  const saturation = sat || analyzeVisibleSaturation();
  const scrolledEnough = autoSaveScrollDepth >= DEEP_SCROLL_BEFORE_ROTATE;
  const scrollExhausted = autoSaveScrollDepth >= MAX_SCROLLS_PER_KEYWORD;

  if (scrolledEnough && saturation.saturated) {
    return "saturation";
  }

  if ((scrolledEnough || scrollExhausted) && saturation.noNewLeft) {
    return "saturation";
  }

  if (
    scrolledEnough &&
    autoSaveClicks >= 6 &&
    autoSaveSaved === autoSaveKeywordSessionSaved &&
    saturation.savedRatio >= 0.4
  ) {
    return "saturation";
  }

  if (scrollExhausted && autoSaveIdle >= 3) {
    return "saturation";
  }

  if (
    autoSaveScrollDepth >= 2 &&
    saturation.total >= SATURATION_MIN_ROWS &&
    saturation.clickable === 0
  ) {
    return "saturation";
  }

  if (minSubscribers <= 0) return null;

  const scanned = stats.total + stats.tooSmallButtons;

  if (stats.rowCount >= 12 && stats.aboveMin === 0 && stats.belowMin >= 8) {
    return "quality";
  }

  if (scanned >= 10 && stats.belowMin / Math.max(stats.total, 1) >= 0.75) {
    return "quality";
  }

  if (autoSaveIdle >= 6 && stats.belowMin >= 5 && stats.aboveMin <= 1) {
    return "quality";
  }

  if (
    autoSaveClicks >= 15 &&
    autoSaveSaved === autoSaveKeywordSessionSaved &&
    autoSaveTooSmall >= 10
  ) {
    return "quality";
  }

  return null;
}

function shouldRotateKeyword(minSubscribers, sat) {
  return getRotateReason(minSubscribers, sat) !== null;
}

function syncAutoSaveToBackground() {
  if (!autoSaveRunning) return;
  chrome.runtime
    .sendMessage({
      type: "influx-auto-save-set",
      state: {
        active: true,
        delayMs: autoSaveDelayMs,
        rotateEnabled: autoSaveRotateEnabled,
        rotations: autoSaveRotations,
        saved: autoSaveSaved,
        tooSmall: autoSaveTooSmall,
        keyword: autoSaveBaseKeyword || autoSaveLastKeyword || influxGetCurrentSearchQuery(),
        filterIndex: autoSaveFilterIndex,
        keywordSessionSaved: autoSaveKeywordSessionSaved,
      },
    })
    .catch(() => {});
}

function clearAutoSaveBackground() {
  chrome.runtime.sendMessage({ type: "influx-auto-save-clear" }).catch(() => {});
}

function waitForYouTubeResults(callback, attempt = 0) {
  const maxAttempts = 40;
  if (
    document.querySelector("ytd-channel-renderer, ytd-video-renderer") ||
    attempt >= maxAttempts
  ) {
    callback();
    return;
  }
  setTimeout(() => waitForYouTubeResults(callback, attempt + 1), 500);
}

function resumeAutoSaveFromState(state) {
  if (!state?.active || autoSaveRunning || quotaStopped) return;
  if (!location.pathname.includes("/results") && !location.search.includes("search_query")) {
    return;
  }

  waitForYouTubeResults(() => {
    if (autoSaveRunning || quotaStopped) return;
    startAutoSave(state.delayMs ?? 1000, {
      fromResume: true,
      rotateEnabled: state.rotateEnabled !== false,
      keyword: state.keyword || influxGetCurrentSearchQuery(),
      filterIndex: state.filterIndex ?? 0,
      keywordSessionSaved: state.keywordSessionSaved ?? state.saved ?? 0,
      rotations: state.rotations ?? 0,
      saved: state.saved ?? 0,
      tooSmall: state.tooSmall ?? 0,
    });
  });
}

function requestAutoSaveResume() {
  chrome.runtime.sendMessage({ type: "influx-auto-save-get" }, (state) => {
    if (chrome.runtime.lastError || !state?.active) return;
    resumeAutoSaveFromState(state);
  });
}

async function advanceSearchTarget(options = {}) {
  try {
    const skipFilters = options.skipFilters === true;
    const reason = options.reason || null;
    const searchKw =
      autoSaveLastKeyword ||
      autoSaveBaseKeyword ||
      influxStripKeywordModifiers(influxGetCurrentSearchQuery());
    const bankKw = influxResolveBankKeyword(searchKw);
    const sessionSaves = autoSaveSaved - autoSaveKeywordSessionSaved;

    if (!skipFilters && autoSaveFilterIndex + 1 < influxGetSearchModeCount()) {
      if (sessionSaves > 0) {
        await influxRecordKeywordProgress(bankKw, sessionSaves);
      }
      autoSaveFilterIndex++;
      autoSaveScrollDepth = 0;
      autoSaveIdle = 0;
      autoSaveKeywordSessionSaved = autoSaveSaved;
      autoSaveBaseKeyword = bankKw;
      autoSaveLastKeyword = searchKw;
      syncAutoSaveToBackground();
      location.assign(influxBuildChannelSearchUrl(searchKw, autoSaveFilterIndex));
      return true;
    }

    if (reason === "saturation") {
      await influxRecordKeywordSaturated(bankKw, {
        saves: sessionSaves,
        scrollDepth: autoSaveScrollDepth,
      });
    } else if (sessionSaves <= 0) {
      await influxRecordKeywordExhausted(bankKw, {
        saves: sessionSaves,
        scrollDepth: autoSaveScrollDepth,
      });
    } else {
      await influxRecordKeywordProgress(bankKw, sessionSaves);
    }

    const next = await influxGetNextKeywordSkippingCooldown(bankKw);
    if (!next) return false;

    const nextSearch = influxStripKeywordModifiers(next);
    autoSaveLastKeyword = nextSearch;
    autoSaveBaseKeyword = influxResolveBankKeyword(nextSearch);
    autoSaveFilterIndex = 0;
    autoSaveRotations++;
    autoSaveIdle = 0;
    autoSaveScrollDepth = 0;
    autoSaveKeywordSessionSaved = autoSaveSaved;
    await influxSaveKeywordCursor(nextSearch);
    syncAutoSaveToBackground();

    // Every 3 keyword switches, divert once into related-crawl queue (then resume search)
    const { relatedCrawl } = await getSettings();
    if (relatedCrawl !== false && autoSaveRotations % 3 === 0) {
      try {
        sessionStorage.setItem("influx_related_auto", "1");
      } catch {
        /* ignore */
      }
      const diverted = await divertToRelatedCrawlIfQueued();
      if (diverted) return true;
      try {
        sessionStorage.removeItem("influx_related_auto");
      } catch {
        /* ignore */
      }
    }

    location.assign(influxBuildChannelSearchUrl(nextSearch, 0));
    return true;
  } catch (err) {
    console.warn("[Influx] advanceSearchTarget failed:", err);
    return false;
  }
}

async function divertToRelatedCrawlIfQueued() {
  try {
    const status = await chrome.runtime.sendMessage({
      type: "influx-related-status",
    });
    if (!status?.queueSize || !status.next) return false;

    // Keep auto-save active; after related crawl finishes we resume keyword search
    syncAutoSaveToBackground();
    await chrome.runtime.sendMessage({
      type: "influx-related-run",
      url: status.next,
    });
    location.assign(status.next);
    return true;
  } catch {
    return false;
  }
}

function findAllSaveButtons() {
  const buttons = [];
  const selector = isVideoSearchResultsPage()
    ? "ytd-video-renderer"
    : "ytd-channel-renderer";
  document.querySelectorAll(selector).forEach((row) => {
    const btn = row.querySelector(".influx-save-btn");
    if (btn) buttons.push(btn);
  });
  const floatBtn = document.getElementById("influx-float-save");
  if (floatBtn) buttons.push(floatBtn);
  return buttons;
}

function isClickableSaveButton(btn) {
  if (!btn || btn.disabled) return false;
  if (btn.dataset.influxSaved === "1") return false;
  if (btn.dataset.influxTooSmall === "1") return false;
  if (btn.dataset.influxAutoQueued === "1") return false;
  return (btn.textContent || "").trim() === SAVE_LABEL;
}

async function markSeenChannelsOnPage() {
  const buttons = findAllSaveButtons();
  for (const btn of buttons) {
    if (btn.dataset.influxSaved === "1") continue;
    const url = btn.dataset.influxUrl || "";
    if (!url) continue;
    if (await influxWasChannelSeen(url)) {
      applySavedButton(btn, true);
      savedCache.set(normalizeUrl(url), true);
    }
  }
}

function updateAutoSaveBadge() {
  let badge = document.getElementById("influx-auto-badge");
  if (!autoSaveRunning) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "influx-auto-badge";
    badge.className = "influx-auto-badge";
    document.body.appendChild(badge);
  }
  const currentKw =
    autoSaveBaseKeyword ||
    autoSaveLastKeyword ||
    influxStripKeywordModifiers(influxGetCurrentSearchQuery()) ||
    "";
  const pos = influxGetKeywordPosition(currentKw);
  const kwLabel = pos
    ? `${pos.nicheId} ${pos.oneBased}/${pos.total}`
    : currentKw || "youtube";

  badge.textContent = [
    "Influx auto-save ON",
    kwLabel,
    influxGetSearchModeLabel(autoSaveFilterIndex),
    `${autoSaveSaved} saved`,
    `${autoSaveTooSmall} too small`,
    autoSaveScrollDepth > 0
      ? `scroll ${autoSaveScrollDepth}/${MAX_SCROLLS_PER_KEYWORD}`
      : null,
    autoSaveRotations ? `${autoSaveRotations} rotations` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

async function autoSaveTick() {
  if (!autoSaveRunning || quotaStopped) return;

  try {
    const { minSubscribers } = await getSettings();
    const saturation = analyzeVisibleSaturation();

    const rotateReason = getRotateReason(minSubscribers, saturation);

    if (rotateReason) {
      updateAutoSaveBadge();
      if (
        await advanceSearchTarget({
          skipFilters: rotateReason === "quality",
          reason: rotateReason,
        })
      ) {
        return;
      }
    }

    if (
      saturation.saturated &&
      saturation.clickable <= 2 &&
      autoSaveScrollDepth < MAX_SCROLLS_PER_KEYWORD
    ) {
      deepScrollForMore();
      updateAutoSaveBadge();
      autoSaveTimer = setTimeout(autoSaveTick, autoSaveDelayMs);
      return;
    }

    await markSeenChannelsOnPage();

    const buttons = [];
    for (const btn of findAllSaveButtons()) {
      if (!isClickableSaveButton(btn)) continue;
      const url = btn.dataset.influxUrl || "";
      if (url && (await influxWasChannelSeen(url))) {
        applySavedButton(btn, true);
        savedCache.set(normalizeUrl(url), true);
        continue;
      }
      buttons.push(btn);
    }

    if (buttons.length === 0) {
      autoSaveIdle++;

      if (
        autoSaveIdle >= 4 &&
        !influxSearchModeHasChannelFilter(autoSaveFilterIndex) &&
        document.querySelectorAll("ytd-video-renderer").length === 0 &&
        document.querySelectorAll("ytd-channel-renderer").length === 0
      ) {
        updateAutoSaveBadge();
        if (await advanceSearchTarget({ skipFilters: false })) return;
      }

      if (autoSaveScrollDepth < MAX_SCROLLS_PER_KEYWORD) {
        deepScrollForMore();
      }

      const readyToRotate =
        autoSaveScrollDepth >= DEEP_SCROLL_BEFORE_ROTATE &&
        (saturation.saturated || saturation.noNewLeft || autoSaveIdle >= 4);
      const forceRotate =
        autoSaveScrollDepth >= MAX_SCROLLS_PER_KEYWORD && autoSaveIdle >= 2;

      if (readyToRotate || forceRotate) {
        updateAutoSaveBadge();
        if (await advanceSearchTarget({ skipFilters: false, reason: "saturation" }))
          return;
      }

      updateAutoSaveBadge();
      autoSaveTimer = setTimeout(autoSaveTick, autoSaveDelayMs);
      return;
    }

    autoSaveIdle = 0;
    const btn = buttons[0];
    btn.dataset.influxAutoQueued = "1";
    btn.scrollIntoView({ block: "center", behavior: "instant" });
    autoSaveClicks++;
    updateAutoSaveBadge();
    btn.click();
  } catch (err) {
    console.warn("[Influx] auto-save tick error:", err);
  }

  autoSaveTimer = setTimeout(autoSaveTick, autoSaveDelayMs);
}

function persistAutoSaveSession(_active) {
  syncAutoSaveToBackground();
}

function startAutoSave(delayMs = 1000, options = {}) {
  stopAutoSave({ keepSession: true });
  resetQuotaStopped();
  quotaStopped = false;
  autoSaveRunning = true;
  autoSaveDelayMs = Math.max(500, delayMs);
  autoSaveRotateEnabled = options.rotateEnabled !== false;
  if (options.fromResume) {
    autoSaveSaved = options.saved ?? 0;
    autoSaveTooSmall = options.tooSmall ?? 0;
    autoSaveRotations = options.rotations ?? 0;
    autoSaveIdle = 0;
    autoSaveClicks = 0;
    autoSaveScrollDepth = 0;
  } else {
    autoSaveIdle = 0;
    autoSaveClicks = 0;
    autoSaveSaved = 0;
    autoSaveTooSmall = 0;
    autoSaveRotations = options.rotations ?? 0;
    autoSaveScrollDepth = 0;
  }
  autoSaveLastKeyword =
    options.keyword || influxGetCurrentSearchQuery() || autoSaveLastKeyword;
  autoSaveBaseKeyword =
    influxResolveBankKeyword(autoSaveLastKeyword) ||
    influxStripKeywordModifiers(autoSaveLastKeyword) ||
    autoSaveBaseKeyword;
  autoSaveFilterIndex = options.filterIndex ?? 0;
  autoSaveKeywordSessionSaved =
    options.keywordSessionSaved ??
    (options.fromResume ? (options.saved ?? 0) : autoSaveSaved);
  syncAutoSaveToBackground();
  updateAutoSaveBadge();
  autoSaveTick();
}

function stopAutoSave(options = {}) {
  autoSaveRunning = false;
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  document.querySelectorAll("[data-influx-auto-queued]").forEach((btn) => {
    delete btn.dataset.influxAutoQueued;
  });
  if (!options.keepSession) clearAutoSaveBackground();
  updateAutoSaveBadge();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "influx-auto-save-resume") {
    resumeAutoSaveFromState(msg.state);
    sendResponse({ ok: true, running: autoSaveRunning });
    return true;
  }

  if (msg.type === "influx-related-resume") {
    maybeAutoStartRelatedCrawl().then(() =>
      sendResponse({ ok: true, running: relatedCrawlRunning })
    );
    return true;
  }

  if (msg.type === "influx-auto-save-start") {
    startAutoSave(msg.delayMs ?? 1000, {
      rotateEnabled: msg.rotateEnabled !== false,
    });
    syncAutoSaveToBackground();
    sendResponse({
      ok: true,
      running: true,
      clicks: autoSaveClicks,
      keyword: autoSaveLastKeyword,
    });
  } else if (msg.type === "influx-auto-save-stop") {
    stopAutoSave();
    sendResponse({
      ok: true,
      running: false,
      clicks: autoSaveClicks,
      saved: autoSaveSaved,
      tooSmall: autoSaveTooSmall,
      rotations: autoSaveRotations,
    });
  } else if (msg.type === "influx-auto-save-status") {
    sendResponse({
      ok: true,
      running: autoSaveRunning,
      delayMs: autoSaveDelayMs,
      clicks: autoSaveClicks,
      saved: autoSaveSaved,
      tooSmall: autoSaveTooSmall,
      rotations: autoSaveRotations,
      keyword: autoSaveLastKeyword || influxGetCurrentSearchQuery(),
      rotateEnabled: autoSaveRotateEnabled,
      quotaStopped,
      quotaMessage: quotaStopped ? QUOTA_STOP_MESSAGE : null,
    });
  } else if (msg.type === "influx-related-crawl-now") {
    startRelatedCrawlForCurrentChannel().then(() =>
      sendResponse({ ok: true })
    );
    return true;
  }
  return true;
});

requestAutoSaveResume();
hookYouTubeSpaNavigation();
maybeAutoStartRelatedCrawl();
// Retry once — /channels content often loads after first paint
setTimeout(() => maybeAutoStartRelatedCrawl().catch(() => {}), 1500);
setTimeout(() => maybeAutoStartRelatedCrawl().catch(() => {}), 3500);

/** Influx Contributor (Electron) bridge — YouTube can't be iframed, so app opens a real window. */
function ensureElectronToolbar() {
  if (document.getElementById("influx-electron-bar")) {
    ensureCaptchaEmailPanel();
    return;
  }
  const bar = document.createElement("div");
  bar.id = "influx-electron-bar";
  bar.innerHTML = `
    <span style="font-weight:700;letter-spacing:.04em">INFLUX</span>
    <button type="button" data-act="start">Start auto-save</button>
    <button type="button" data-act="stop">Stop</button>
    <span data-status style="opacity:.85;font-size:12px">Ready</span>
  `;
  Object.assign(bar.style, {
    position: "fixed",
    left: "50%",
    bottom: "18px",
    transform: "translateX(-50%)",
    zIndex: "2147483646",
    display: "flex",
    gap: "10px",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(15,20,28,.94)",
    color: "#e8eef4",
    border: "1px solid rgba(61,156,240,.45)",
    boxShadow: "0 10px 40px rgba(0,0,0,.45)",
    fontFamily: "system-ui,sans-serif",
    fontSize: "13px",
  });
  bar.querySelectorAll("button").forEach((btn) => {
    Object.assign(btn.style, {
      border: "0",
      borderRadius: "999px",
      padding: "7px 12px",
      cursor: "pointer",
      fontWeight: "600",
      background: btn.dataset.act === "start" ? "#3d9cf0" : "#3a4554",
      color: btn.dataset.act === "start" ? "#041018" : "#e8eef4",
    });
  });
  bar.addEventListener("click", async (e) => {
    const act = e.target?.dataset?.act;
    const status = bar.querySelector("[data-status]");
    if (act === "start") {
      try {
        // Always start on a different freshened keyword (never same USA SERP cycle)
        const fresh = await influxPickFreshStartKeyword();
        if (fresh) {
          if (status) status.textContent = `Starting: ${fresh}…`;
          await influxSaveKeywordCursor(fresh);
          startAutoSave(1000, {
            rotateEnabled: true,
            keyword: fresh,
          });
          syncAutoSaveToBackground();
          location.assign(influxBuildChannelSearchUrl(fresh, 0));
          return;
        }
      } catch (err) {
        console.warn("[Influx] fresh start pick failed:", err);
      }
      startAutoSave(1000, { rotateEnabled: true });
      syncAutoSaveToBackground();
      if (status) status.textContent = "Auto-save running…";
    }
    if (act === "stop") {
      stopAutoSave();
      if (status) {
        status.textContent = `Stopped · saved ${autoSaveSaved} · rotations ${autoSaveRotations}`;
      }
    }
  });
  document.documentElement.appendChild(bar);
  ensureCaptchaEmailPanel();
}

function influxIsChannelPage() {
  return /youtube\.com\/(@|channel\/UC)/i.test(location.href);
}

function detectYouTubeChannelFromPage() {
  const href = location.href;
  let id = null;
  let handle = null;
  const ch = href.match(/\/channel\/(UC[\w-]{22})/i);
  if (ch) id = ch[1];
  const h = href.match(/\/@([^/?#]+)/);
  if (h) handle = `@${decodeURIComponent(h[1])}`;

  // Injected by Electron when opening from captcha queue
  try {
    const queued = document.documentElement.getAttribute("data-influx-channel");
    if (queued) {
      const q = JSON.parse(queued);
      if (q.id && /^UC[\w-]{22}$/i.test(q.id)) id = q.id;
      if (!handle && q.handle) handle = q.handle.startsWith("@") ? q.handle : `@${q.handle}`;
    }
  } catch {
    /* ignore */
  }

  try {
    const html = document.documentElement.innerHTML.slice(0, 800000);
    const patterns = [
      /"channelId"\s*:\s*"(UC[\w-]{22})"/,
      /"externalId"\s*:\s*"(UC[\w-]{22})"/,
      /"browseId"\s*:\s*"(UC[\w-]{22})"/,
      /\/channel\/(UC[\w-]{22})/,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) {
        id = m[1];
        break;
      }
    }
  } catch {
    /* ignore */
  }
  const title =
    document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
    document
      .querySelector("#channel-name yt-formatted-string, ytd-channel-name yt-formatted-string")
      ?.textContent?.trim() ||
    null;
  return { id, handle, title };
}

function scanEmailsOnYouTubePage() {
  const junk =
    /noreply|no-reply|example\.com|sentry|instagram\.com|facebook\.com|zendesk|patreon\.com|youtube\.com|google\.com|guidelines@|support@|privacy@|legal@|help@/i;
  const found = [];
  const add = (raw) => {
    if (!raw) return;
    let e = String(raw)
      .toLowerCase()
      .replace(/^mailto:/i, "")
      .replace(/\?.*$/, "")
      .replace(/^u003[ce]/, "")
      .trim();
    if (!e.includes("@") || junk.test(e) || found.includes(e)) return;
    found.push(e);
  };

  document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
    add(a.getAttribute("href"));
  });

  const text = document.body?.innerText || "";
  // Prefer lines near "email" / "business"
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const near =
      /e-?mail|business|contact|inquir/i.test(line) ||
      (i > 0 && /e-?mail|business|contact|inquir/i.test(lines[i - 1]));
    if (!near && !line.includes("@")) continue;
    for (const m of line.matchAll(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    )) {
      add(m[0]);
    }
  }

  for (const m of text.matchAll(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  )) {
    add(m[0]);
  }

  return found;
}

function ensureCaptchaEmailPanel() {
  let panel = document.getElementById("influx-captcha-email");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "influx-captcha-email";
    panel.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px;letter-spacing:.03em">Captcha email</div>
      <div data-ch style="font-size:11px;opacity:.8;margin-bottom:8px;line-height:1.35">Open a channel → About → View email → solve captcha</div>
      <input data-email type="email" placeholder="email@creator.com" spellcheck="false"
        style="width:100%;box-sizing:border-box;margin:0 0 8px;padding:8px 10px;border-radius:8px;border:1px solid #2a3542;background:#0d1218;color:#e8eef4;font-size:13px" />
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" data-act="scan" style="border:0;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer;background:#3a4554;color:#e8eef4">Scan page</button>
        <button type="button" data-act="save" style="border:0;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer;background:#3ecf8e;color:#041018">Save to Influx</button>
        <button type="button" data-act="skip" style="border:0;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer;background:#243041;color:#8b9aab">No email</button>
      </div>
      <div data-msg style="margin-top:8px;font-size:11px;opacity:.9;min-height:14px"></div>
    `;
    Object.assign(panel.style, {
      position: "fixed",
      left: "16px",
      bottom: "18px",
      zIndex: "2147483646",
      width: "280px",
      padding: "12px 14px",
      borderRadius: "14px",
      background: "rgba(15,20,28,.96)",
      color: "#e8eef4",
      border: "1px solid rgba(62,207,142,.4)",
      boxShadow: "0 10px 40px rgba(0,0,0,.45)",
      fontFamily: "system-ui,sans-serif",
      fontSize: "12px",
      display: "none",
    });

    const setMsg = (t, ok) => {
      const el = panel.querySelector("[data-msg]");
      if (!el) return;
      el.textContent = t;
      el.style.color = ok ? "#3ecf8e" : "#e8eef4";
    };

    const refreshChannelLabel = () => {
      const ch = detectYouTubeChannelFromPage();
      const el = panel.querySelector("[data-ch]");
      if (!el) return;
      if (!influxIsChannelPage()) {
        el.textContent = "Go to a channel page (About) to save captcha email";
        return;
      }
      el.textContent = [
        ch.title || "Channel",
        ch.handle || "",
        ch.id || "(resolving id…)",
      ]
        .filter(Boolean)
        .join(" · ");
    };

    panel.addEventListener("click", async (e) => {
      const act = e.target?.dataset?.act;
      if (!act) return;
      const input = panel.querySelector("[data-email]");
      refreshChannelLabel();

      if (act === "scan") {
        const emails = scanEmailsOnYouTubePage();
        if (emails.length) {
          input.value = emails[0];
          setMsg(`Found ${emails[0]} — click Save`, true);
        } else {
          setMsg("No email visible yet — solve captcha first, then Scan", false);
        }
        return;
      }

      if (act === "save") {
        const email = (input?.value || "").trim();
        if (!email.includes("@")) {
          setMsg("Enter or Scan an email first", false);
          return;
        }
        const ch = detectYouTubeChannelFromPage();
        if (!ch.id && !ch.handle) {
          setMsg("Open a YouTube channel page first", false);
          return;
        }
        setMsg("Saving…", false);
        try {
          const s = await getSettings();
          if (!s.workerKey) {
            setMsg("Save worker key in Dashboard first", false);
            return;
          }
          const res = await fetch(
            `${(s.apiUrl || DEFAULT_API).replace(/\/$/, "")}/api/worker/emails/set`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${s.workerKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                channel_id: ch.id || undefined,
                handle: ch.handle || undefined,
                title: ch.title || undefined,
                email,
                source: "youtube-captcha-manual",
                force: false,
              }),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setMsg(data.error || `HTTP ${res.status}`, false);
            return;
          }
          if (data.updated) {
            setMsg(`Saved ${data.email} ✓`, true);
            input.value = "";
          } else {
            setMsg(`Already had ${data.email}`, true);
          }
        } catch (err) {
          setMsg(err instanceof Error ? err.message : String(err), false);
        }
        return;
      }

      if (act === "skip") {
        const ch = detectYouTubeChannelFromPage();
        if (!ch.id && !ch.handle) {
          setMsg("Open a YouTube channel page first", false);
          return;
        }
        setMsg("Marking no email…", false);
        try {
          const s = await getSettings();
          if (!s.workerKey) {
            setMsg("Save worker key in Dashboard first", false);
            return;
          }
          const res = await fetch(
            `${(s.apiUrl || DEFAULT_API).replace(/\/$/, "")}/api/worker/emails/skip`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${s.workerKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                channel_id: ch.id || undefined,
                handle: ch.handle || undefined,
                reason: "no_public_email",
              }),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setMsg(data.error || `HTTP ${res.status}`, false);
            return;
          }
          setMsg("Marked no email — removed from queue ✓", true);
        } catch (err) {
          setMsg(err instanceof Error ? err.message : String(err), false);
        }
      }
    });

    // Auto-scan when mailto appears after captcha
    const obs = new MutationObserver(() => {
      if (panel.style.display === "none") return;
      const input = panel.querySelector("[data-email]");
      if (input?.value) return;
      const emails = scanEmailsOnYouTubePage();
      if (emails.length) {
        input.value = emails[0];
        const msg = panel.querySelector("[data-msg]");
        if (msg) {
          msg.textContent = `Detected ${emails[0]} — click Save`;
          msg.style.color = "#3ecf8e";
        }
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.documentElement.appendChild(panel);

    const syncVisibility = () => {
      panel.style.display = influxIsChannelPage() ? "block" : "none";
      refreshChannelLabel();
    };
    syncVisibility();
    setInterval(syncVisibility, 1500);
  } else {
    panel.style.display = influxIsChannelPage() ? "block" : "none";
  }
}

window.addEventListener("message", (ev) => {
  if (ev.source !== window) return;
  const data = ev.data;
  if (!data || data.source !== "influx-electron") return;

  if (data.type === "boot" && data.settings) {
    try {
      document.documentElement.setAttribute(
        "data-influx-settings",
        JSON.stringify(data.settings)
      );
    } catch {
      /* ignore */
    }
    chrome.storage.sync
      .set({
        apiUrl: data.settings.apiUrl,
        workerKey: data.settings.workerKey,
        usaOnly: data.settings.usaOnly !== false,
        minSubscribers: data.settings.minSubscribers ?? 1000,
        lightSave: data.settings.lightSave !== false,
        relatedCrawl: data.settings.relatedCrawl !== false,
        autoDelayMs: data.settings.autoDelayMs ?? 1000,
        autoRotate: data.settings.autoRotate !== false,
      })
      .then(() => {
        ensureElectronToolbar();
      })
      .catch(() => ensureElectronToolbar());
  }

  if (data.type === "start-auto-save") {
    ensureElectronToolbar();
    startAutoSave(data.delayMs ?? 1000, {
      rotateEnabled: data.rotateEnabled !== false,
    });
    syncAutoSaveToBackground();
  }

  if (data.type === "stop-auto-save") {
    stopAutoSave();
  }
});

// If already inside Electron youtube partition, show toolbar after a beat
setTimeout(() => {
  try {
    if (chrome?.runtime?.id) ensureElectronToolbar();
  } catch {
    /* ignore */
  }
}, 1200);
