/** Keeps auto-save + related-crawl queue across YouTube navigations. */

const STORAGE_KEY = "influxAutoSaveState";
const RELATED_QUEUE_KEY = "influxRelatedCrawlQueue";
const RELATED_RUN_KEY = "influxRelatedCrawlRun";

let autoSaveState = null;
/** @type {string[]} */
let relatedQueue = [];
/** @type {{ url: string, tabId: number|null, startedAt: number } | null} */
let relatedRun = null;

async function loadState() {
  if (autoSaveState) return autoSaveState;
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    autoSaveState = result[STORAGE_KEY] ?? null;
  } catch {
    autoSaveState = null;
  }
  return autoSaveState;
}

async function saveState(state, tabId) {
  autoSaveState = state
    ? {
        ...state,
        tabId: tabId ?? state.tabId ?? null,
        updatedAt: Date.now(),
      }
    : null;

  try {
    if (autoSaveState) {
      await chrome.storage.local.set({ [STORAGE_KEY]: autoSaveState });
    } else {
      await chrome.storage.local.remove(STORAGE_KEY);
    }
  } catch {
    /* memory-only fallback */
  }
}

async function clearState() {
  await saveState(null);
}

async function loadRelatedQueue() {
  try {
    const result = await chrome.storage.local.get([
      RELATED_QUEUE_KEY,
      RELATED_RUN_KEY,
    ]);
    relatedQueue = Array.isArray(result[RELATED_QUEUE_KEY])
      ? result[RELATED_QUEUE_KEY]
      : [];
    relatedRun = result[RELATED_RUN_KEY] ?? null;
  } catch {
    relatedQueue = relatedQueue || [];
  }
  return relatedQueue;
}

async function persistRelatedQueue() {
  try {
    await chrome.storage.local.set({
      [RELATED_QUEUE_KEY]: relatedQueue.slice(0, 200),
      [RELATED_RUN_KEY]: relatedRun,
    });
  } catch {
    /* ignore */
  }
}

function normalizeRelatedUrl(url) {
  return String(url || "")
    .split(/[?#]/)[0]
    .replace(/\/$/, "");
}

async function enqueueRelated(url) {
  await loadRelatedQueue();
  const n = normalizeRelatedUrl(url);
  if (!n || !n.includes("youtube.com")) return relatedQueue.length;
  if (!relatedQueue.some((u) => normalizeRelatedUrl(u) === n)) {
    relatedQueue.push(n);
  }
  await persistRelatedQueue();
  return relatedQueue.length;
}

async function dequeueRelated(url) {
  await loadRelatedQueue();
  const n = normalizeRelatedUrl(url);
  relatedQueue = relatedQueue.filter((u) => normalizeRelatedUrl(u) !== n);
  if (relatedRun && normalizeRelatedUrl(relatedRun.url) === n) {
    relatedRun = null;
  }
  await persistRelatedQueue();
  return relatedQueue.length;
}

async function peekRelated() {
  await loadRelatedQueue();
  return relatedQueue[0] || null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === "influx-auto-save-set") {
      await saveState(msg.state, sender.tab?.id);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "influx-auto-save-get") {
      const state = await loadState();
      sendResponse(state);
      return;
    }

    if (msg.type === "influx-auto-save-clear") {
      await clearState();
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "influx-related-enqueue") {
      const size = await enqueueRelated(msg.url);
      sendResponse({ ok: true, queueSize: size });
      return;
    }

    if (msg.type === "influx-related-run") {
      await loadRelatedQueue();
      relatedRun = {
        url: normalizeRelatedUrl(msg.url),
        tabId: sender.tab?.id ?? null,
        startedAt: Date.now(),
      };
      await enqueueRelated(msg.url);
      await persistRelatedQueue();
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "influx-related-done") {
      await dequeueRelated(msg.url);
      sendResponse({ ok: true, queueSize: relatedQueue.length });
      return;
    }

    if (msg.type === "influx-related-status") {
      await loadRelatedQueue();
      sendResponse({
        ok: true,
        queueSize: relatedQueue.length,
        next: relatedQueue[0] || null,
        running: relatedRun,
      });
      return;
    }

    if (msg.type === "influx-related-process-next") {
      await loadRelatedQueue();
      const next = relatedQueue[0];
      if (!next) {
        sendResponse({ ok: false, empty: true });
        return;
      }
      relatedRun = {
        url: next,
        tabId: sender.tab?.id ?? msg.tabId ?? null,
        startedAt: Date.now(),
      };
      await persistRelatedQueue();

      const tabId = relatedRun.tabId;
      if (tabId) {
        await chrome.tabs.update(tabId, { url: next });
      }
      sendResponse({ ok: true, url: next });
      return;
    }

    if (msg.type === "influx-related-should-auto-crawl") {
      await loadRelatedQueue();
      const pageUrl = normalizeRelatedUrl(msg.url || "");
      const pagePath = (() => {
        try {
          return new URL(pageUrl).pathname.replace(/\/$/, "").toLowerCase();
        } catch {
          return pageUrl.toLowerCase();
        }
      })();

      const matchesRun = (runUrl) => {
        const n = normalizeRelatedUrl(runUrl);
        if (n === pageUrl) return true;
        try {
          const p = new URL(n).pathname.replace(/\/$/, "").toLowerCase();
          return p === pagePath || pagePath.endsWith(p) || p.endsWith(pagePath);
        } catch {
          return n.toLowerCase().includes(pagePath);
        }
      };

      const inQueue = relatedQueue.some((u) => matchesRun(u));
      const runMatch = relatedRun && matchesRun(relatedRun.url);
      const runFresh =
        !!relatedRun &&
        Date.now() - (relatedRun.startedAt || 0) < 15 * 60 * 1000;

      const should = (runMatch && runFresh) || inQueue;
      sendResponse({
        ok: true,
        should,
        queueSize: relatedQueue.length,
        reason: runMatch ? "run" : inQueue ? "queue" : "none",
      });
      return;
    }

    if (msg.type === "influx-sync-from-app") {
      const ok = await syncFromContributorApp();
      sendResponse({ ok });
      return;
    }
  })().catch(() => sendResponse(null));

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== "complete") return;
  loadState().then((state) => {
    if (!state?.active) return;
    if (state.tabId && state.tabId !== tabId) return;

    chrome.tabs
      .sendMessage(tabId, { type: "influx-auto-save-resume", state })
      .catch(() => {});
  });

  loadRelatedQueue().then(() => {
    if (!relatedRun) return;
    if (relatedRun.tabId && relatedRun.tabId !== tabId) return;

    chrome.tabs
      .sendMessage(tabId, {
        type: "influx-related-resume",
        url: relatedRun.url,
      })
      .catch(() => {});
  });
});

loadState();
loadRelatedQueue();

/** Pull keys from Influx Contributor Electron app (localhost bridge). */
async function syncFromContributorApp() {
  try {
    const res = await fetch("http://127.0.0.1:17341/influx-settings", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.ok || !data.workerKey) return false;
    await chrome.storage.sync.set({
      apiUrl: data.apiUrl || "https://influencer-platform-mu.vercel.app",
      workerKey: data.workerKey,
      usaOnly: data.usaOnly !== false,
      lightSave: data.lightSave !== false,
      relatedCrawl: data.relatedCrawl !== false,
      minSubscribers:
        typeof data.minSubscribers === "number" ? data.minSubscribers : 1000,
    });
    return true;
  } catch {
    return false;
  }
}

syncFromContributorApp();
setInterval(() => {
  syncFromContributorApp();
}, 30_000);
