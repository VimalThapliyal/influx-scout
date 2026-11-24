/**
 * Instagram BrowserView — login once (session persisted), then fill missing
 * emails from IG bios / contact / link-in-bio onto YouTube channel rows.
 */
const { BrowserView } = require("electron");

let igView = null;
let hostWindow = null;
let fillStopping = false;
let fillRunning = false;
const TAB_BAR_HEIGHT = 52;

const EXTRACT_EMAIL_JS = `(() => {
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g;
  const junk = /noreply|no-reply|example\\.com|sentry|instagram\\.com|facebook\\.com|zendesk|patreon\\.com|guidelines@|support@|privacy@|legal@|help@/i;
  const found = [];
  const add = (e) => {
    if (!e) return;
    let x = String(e).toLowerCase().replace(/^mailto:/i, "").replace(/^u003[ce]/, "").trim();
    if (!x.includes("@") || junk.test(x) || found.includes(x)) return;
    found.push(x);
  };

  document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
    add(a.getAttribute("href"));
  });

  const html = document.documentElement.innerHTML || "";
  for (const re of [
    /"public_email"\\s*:\\s*"([^"]+)"/gi,
    /"business_email"\\s*:\\s*"([^"]+)"/gi,
    /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/gi,
  ]) {
    for (const m of html.matchAll(re)) add(m[1]);
  }
  for (const m of html.matchAll(/"biography"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"/gi)) {
    const bio = m[1]
      .replace(/\\\\u0026/g, "&")
      .replace(/\\\\n/g, " ")
      .replace(/\\\\"/g, '"');
    for (const em of bio.matchAll(EMAIL_RE)) add(em[0]);
  }

  const text = document.body ? document.body.innerText : "";
  for (const em of text.matchAll(EMAIL_RE)) add(em[0]);

  const external = [];
  for (const re of [
    /"external_url"\\s*:\\s*"(https?:\\\\?\\/\\\\?\\/[^"]+)"/gi,
    /href="(https?:\\/\\/(?:linktr\\.ee|beacons\\.ai|bio\\.link|carrd\\.co|stan\\.store|lnk\\.bio|solo\\.to|hoo\\.be)[^"]*)"/gi,
  ]) {
    for (const m of html.matchAll(re)) {
      let u = (m[1] || "").replace(/\\\\\\//g, "/").replace(/\\\\u0026/g, "&");
      try {
        u = new URL(u).toString();
        if (!u.includes("instagram.com") && !external.includes(u)) external.push(u);
      } catch {}
    }
  }

  return { email: found[0] || null, emails: found, externalUrls: external.slice(0, 3) };
})()`;

function layoutIgView() {
  if (!igView || !hostWindow || hostWindow.isDestroyed()) return;
  const [width, height] = hostWindow.getContentSize();
  igView.setBounds({
    x: 0,
    y: TAB_BAR_HEIGHT,
    width,
    height: Math.max(100, height - TAB_BAR_HEIGHT),
  });
}

function normalizeIgUrl(raw) {
  if (!raw) return null;
  try {
    let u = String(raw).trim();
    if (u.startsWith("@")) u = `https://www.instagram.com/${u.slice(1)}/`;
    if (!/^https?:\/\//i.test(u)) u = `https://www.instagram.com/${u.replace(/^\/+/, "")}`;
    const parsed = new URL(u);
    if (!parsed.hostname.includes("instagram.com")) return null;
    // Keep /username/ form
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (!parts.length) return "https://www.instagram.com/";
    const user = parts[0];
    if (/^(p|reel|reels|stories|explore|accounts)$/i.test(user)) return parsed.toString();
    return `https://www.instagram.com/${user}/`;
  } catch {
    return null;
  }
}

async function waitForLoad(wc, timeoutMs = 25000) {
  if (wc.isLoading()) {
    await new Promise((resolve) => {
      const t = setTimeout(resolve, timeoutMs);
      wc.once("did-finish-load", () => {
        clearTimeout(t);
        resolve();
      });
    });
  }
  await new Promise((r) => setTimeout(r, 1200));
}

async function extractFromCurrentPage() {
  if (!igView) return { email: null, emails: [], externalUrls: [] };
  try {
    return await igView.webContents.executeJavaScript(EXTRACT_EMAIL_JS, true);
  } catch {
    return { email: null, emails: [], externalUrls: [] };
  }
}

async function loadUrl(url) {
  if (!igView) throw new Error("Instagram tab not open");
  await igView.webContents.loadURL(url);
  await waitForLoad(igView.webContents);
}

async function attachInstagramTab(mainWindow, opts = {}) {
  const { onLog = () => {} } = opts;
  hostWindow = mainWindow;

  if (!igView) {
    const { session } = require("electron");
    const ses = session.fromPartition("persist:influx-instagram");
    igView = new BrowserView({
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    await igView.webContents.loadURL("https://www.instagram.com/");
  }

  mainWindow.setBrowserView(igView);
  layoutIgView();

  const onResize = () => layoutIgView();
  mainWindow.removeListener("resize", onResize);
  mainWindow.on("resize", onResize);

  onLog(
    "Instagram tab ready. Log in once (session is saved). Then use Fill missing emails from IG."
  );
  return { ok: true };
}

function showInstagramTab(mainWindow) {
  if (!igView || !mainWindow || mainWindow.isDestroyed()) return false;
  hostWindow = mainWindow;
  mainWindow.setBrowserView(igView);
  layoutIgView();
  return true;
}

function hideInstagramTab(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (igView) {
    try {
      mainWindow.removeBrowserView(igView);
    } catch {
      mainWindow.setBrowserView(null);
    }
  }
}

function destroyInstagramTab(mainWindow) {
  fillStopping = true;
  hideInstagramTab(mainWindow);
  if (igView) {
    try {
      igView.webContents.destroy();
    } catch {
      /* ignore */
    }
  }
  igView = null;
  fillRunning = false;
}

async function apiGet(apiUrl, workerKey, path) {
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    headers: { Authorization: `Bearer ${workerKey}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiPost(apiUrl, workerKey, path, body) {
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * Walk channels missing email that have Instagram URLs; scrape while logged in.
 */
async function fillMissingEmailsFromIg(opts) {
  const {
    apiUrl,
    workerKey,
    limit = 40,
    delayMs = 2500,
    onLog = () => {},
    onProgress = () => {},
  } = opts;

  if (fillRunning) throw new Error("IG fill already running");
  if (!igView) throw new Error("Open the Instagram tab and log in first");

  fillRunning = true;
  fillStopping = false;

  let found = 0;
  let tried = 0;
  let skipped = 0;

  try {
    const list = await apiGet(
      apiUrl,
      workerKey,
      `/api/worker/emails/missing-ig?limit=${Math.max(1, Math.min(100, limit))}`
    );
    const channels = list.channels || [];
    onLog(
      `IG fill: ${channels.length} channel(s) with Instagram but no email (pool ~${list.total ?? "?"})`
    );

    if (channels.length === 0) {
      onLog("IG fill: nothing to do — no channels with Instagram missing email.");
      return { found: 0, tried: 0, skipped: 0 };
    }

    // Quick login check
    const cur = igView.webContents.getURL() || "";
    if (!cur.includes("instagram.com")) {
      await loadUrl("https://www.instagram.com/");
    }
    const probe = await extractFromCurrentPage();
    void probe;
    const htmlHint = await igView.webContents
      .executeJavaScript(
        `document.body && /log\\s*in|sign\\s*up/i.test(document.body.innerText || "") && !/profile|home|search|messages/i.test(document.title||"")`,
        true
      )
      .catch(() => false);
    if (htmlHint) {
      onLog(
        "IG fill: please log into Instagram in this tab first, then click Fill again."
      );
      return { found: 0, tried: 0, skipped: 0, needLogin: true };
    }

    for (const ch of channels) {
      if (fillStopping) {
        onLog("IG fill: stopped.");
        break;
      }
      const igUrl = normalizeIgUrl(ch.instagram);
      if (!igUrl) {
        skipped++;
        continue;
      }

      tried++;
      onLog(`IG fill: ${ch.title || ch.handle || ch.id} → ${igUrl}`);
      onProgress({ tried, found, skipped, title: ch.title });

      try {
        await loadUrl(igUrl);
        let result = await extractFromCurrentPage();

        // Follow link-in-bio if no email on profile
        if (!result.email && result.externalUrls && result.externalUrls.length) {
          const ext = result.externalUrls[0];
          onLog(`  → link-in-bio ${ext}`);
          await loadUrl(ext);
          const fromExt = await extractFromCurrentPage();
          if (fromExt.email) {
            result = { ...fromExt, email: fromExt.email };
          }
          // return to IG for next profile session warmth
        }

        if (result.email) {
          const saved = await apiPost(apiUrl, workerKey, "/api/worker/emails/set", {
            channel_id: ch.id,
            email: result.email,
            source: igUrl,
          });
          if (saved.updated) {
            found++;
            onLog(`  ✉ ${result.email} saved on ${ch.title}`);
          } else {
            onLog(`  (skipped save: ${saved.reason || "not updated"})`);
            skipped++;
          }
        } else {
          skipped++;
          onLog("  no public email on profile / link-in-bio");
        }
      } catch (err) {
        skipped++;
        onLog(
          `  fail: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      if (delayMs > 0 && !fillStopping) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    onLog(`IG fill done: found=${found} tried=${tried} skipped=${skipped}`);
    return { found, tried, skipped };
  } finally {
    fillRunning = false;
    fillStopping = false;
  }
}

function stopFillMissingEmails() {
  fillStopping = true;
}

function isFillRunning() {
  return fillRunning;
}

module.exports = {
  attachInstagramTab,
  showInstagramTab,
  hideInstagramTab,
  destroyInstagramTab,
  fillMissingEmailsFromIg,
  stopFillMissingEmails,
  isFillRunning,
  TAB_BAR_HEIGHT,
};
