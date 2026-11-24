const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { ContributeEngine } = require("./engine/contribute");
const {
  startSettingsBridge,
  stopSettingsBridge,
} = require("./settings-bridge");
const {
  attachYouTubeTab,
  showYouTubeTab,
  hideYouTubeTab,
  updateYouTubeSettings,
  destroyYouTubeTab,
  navigateYouTubeTo,
} = require("./youtube-window");
const {
  attachInstagramTab,
  showInstagramTab,
  hideInstagramTab,
  destroyInstagramTab,
  fillMissingEmailsFromIg,
  stopFillMissingEmails,
  isFillRunning,
} = require("./instagram-window");

let mainWindow = null;
let engine = null;
let youtubeReady = false;
let instagramReady = false;

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    return {
      apiUrl: "https://influencer-platform-mu.vercel.app",
      workerKey: "",
      youtubeKey: "",
    };
  }
}

function saveSettings(settings) {
  const cleaned = {
    apiUrl: String(settings.apiUrl || "")
      .trim()
      .replace(/\/$/, ""),
    workerKey: String(settings.workerKey || "")
      .trim()
      .replace(/^Bearer\s+/i, ""),
    youtubeKey: String(settings.youtubeKey || "").trim(),
  };
  fs.writeFileSync(settingsPath(), JSON.stringify(cleaned, null, 2), "utf8");
  updateYouTubeSettings(cleaned).catch(() => {});
  return cleaned;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    title: "Influx Contributor",
    backgroundColor: "#0f1419",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.on("closed", () => {
    destroyYouTubeTab(mainWindow);
    destroyInstagramTab(mainWindow);
    mainWindow = null;
    youtubeReady = false;
    instagramReady = false;
  });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function hideBrowserTabs() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  hideYouTubeTab(mainWindow);
  hideInstagramTab(mainWindow);
}

app.whenReady().then(() => {
  startSettingsBridge(() => loadSettings());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (engine) engine.stop();
  stopSettingsBridge();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopSettingsBridge();
  stopFillMissingEmails();
  if (mainWindow) {
    destroyYouTubeTab(mainWindow);
    destroyInstagramTab(mainWindow);
  }
});

ipcMain.handle("settings:get", () => loadSettings());

ipcMain.handle("settings:save", (_e, settings) => {
  saveSettings(settings);
  return { ok: true };
});

ipcMain.handle("status:fetch", async () => {
  const s = loadSettings();
  if (!s.workerKey) throw new Error("Save a worker key first");
  const eng = new ContributeEngine({
    apiUrl: s.apiUrl,
    workerKey: s.workerKey,
    youtubeKey: s.youtubeKey,
  });
  return eng.fetchStatus();
});

ipcMain.handle("contribute:start", async () => {
  if (engine && !engine.stopping) {
    return { ok: false, error: "Already running" };
  }
  const s = loadSettings();
  if (!s.workerKey) throw new Error("Worker key required");
  if (!s.apiUrl) throw new Error("API URL required");

  engine = new ContributeEngine({
    apiUrl: s.apiUrl,
    workerKey: s.workerKey,
    youtubeKey: s.youtubeKey,
    seedLimit: 8,
    enrichLimit: 150,
    onLog: (msg) =>
      send("contribute:log", { msg, at: new Date().toISOString() }),
    onStats: (stats) => send("contribute:stats", stats),
  });

  send("contribute:log", {
    msg: "Starting list/enrich loop…",
    at: new Date().toISOString(),
  });
  engine.runLoop({ sleepSec: 8 }).catch((err) => {
    send("contribute:log", {
      msg: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    });
    send("contribute:stopped", {});
  });
  send("contribute:started", {});
  return { ok: true };
});

ipcMain.handle("contribute:stop", async () => {
  if (engine) {
    engine.stop();
    send("contribute:log", {
      msg: "Stop requested…",
      at: new Date().toISOString(),
    });
  }
  send("contribute:stopped", {});
  return { ok: true };
});

ipcMain.handle("youtube:show-tab", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Main window missing");
  }
  const s = loadSettings();
  if (!s.workerKey) {
    throw new Error("Save your worker key on the Dashboard tab first");
  }

  hideInstagramTab(mainWindow);

  if (!youtubeReady) {
    await attachYouTubeTab(mainWindow, {
      appRoot: __dirname,
      settings: s,
      onLog: (msg) =>
        send("contribute:log", { msg, at: new Date().toISOString() }),
    });
    youtubeReady = true;
  } else {
    showYouTubeTab(mainWindow);
    await updateYouTubeSettings(s);
  }
  return { ok: true };
});

ipcMain.handle("youtube:hide-tab", async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    hideYouTubeTab(mainWindow);
  }
  return { ok: true };
});

ipcMain.handle("emails:captcha-queue", async (_e, opts = {}) => {
  const s = loadSettings();
  if (!s.workerKey) throw new Error("Save a worker key first");
  const limit = Math.max(1, Math.min(100, Number(opts.limit) || 40));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const noLinks = opts.noLinks === true;
  const minSubs = Math.max(0, Number(opts.minSubs) || 0);
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (noLinks) params.set("no_links", "1");
  if (minSubs > 0) params.set("min_subs", String(minSubs));

  const res = await fetch(
    `${s.apiUrl}/api/worker/emails/captcha-queue?${params}`,
    { headers: { Authorization: `Bearer ${s.workerKey}` } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
});

ipcMain.handle("emails:captcha-skip", async (_e, payload = {}) => {
  const s = loadSettings();
  if (!s.workerKey) throw new Error("Save a worker key first");
  const res = await fetch(`${s.apiUrl}/api/worker/emails/skip`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.workerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel_id: payload.channel_id || payload.id,
      handle: payload.handle,
      reason: payload.reason || "no_public_email",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
});

ipcMain.handle("youtube:open-about", async (_e, payload) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Main window missing");
  }
  const s = loadSettings();
  if (!s.workerKey) {
    throw new Error("Save your worker key on the Dashboard tab first");
  }

  const aboutUrl =
    typeof payload === "string" ? payload : payload?.about_url || payload?.url;
  const meta =
    typeof payload === "object" && payload
      ? {
          id: payload.id || null,
          handle: payload.handle || null,
          title: payload.title || null,
        }
      : null;

  if (!aboutUrl) throw new Error("about_url required");

  hideInstagramTab(mainWindow);

  if (!youtubeReady) {
    await attachYouTubeTab(mainWindow, {
      appRoot: __dirname,
      settings: s,
      onLog: (msg) =>
        send("contribute:log", { msg, at: new Date().toISOString() }),
    });
    youtubeReady = true;
  } else {
    showYouTubeTab(mainWindow);
    await updateYouTubeSettings(s);
  }

  await navigateYouTubeTo(aboutUrl, meta);
  send("contribute:log", {
    msg: `Opened About: ${aboutUrl} — solve captcha, then Scan / Save in the green box`,
    at: new Date().toISOString(),
  });
  return { ok: true };
});

ipcMain.handle("instagram:show-tab", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Main window missing");
  }
  const s = loadSettings();
  if (!s.workerKey) {
    throw new Error("Save your worker key on the Dashboard tab first");
  }

  hideYouTubeTab(mainWindow);

  if (!instagramReady) {
    await attachInstagramTab(mainWindow, {
      onLog: (msg) =>
        send("contribute:log", { msg, at: new Date().toISOString() }),
    });
    instagramReady = true;
  } else {
    showInstagramTab(mainWindow);
  }
  return { ok: true };
});

ipcMain.handle("instagram:hide-tab", async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    hideInstagramTab(mainWindow);
  }
  return { ok: true };
});

ipcMain.handle("instagram:fill-start", async (_e, opts = {}) => {
  const s = loadSettings();
  if (!s.workerKey) throw new Error("Worker key required");
  if (!instagramReady || !mainWindow) {
    throw new Error("Open the Instagram tab and log in first");
  }
  if (isFillRunning()) {
    return { ok: false, error: "Already filling" };
  }

  // Ensure IG view is visible while filling
  hideYouTubeTab(mainWindow);
  showInstagramTab(mainWindow);

  send("instagram:fill-started", {});
  fillMissingEmailsFromIg({
    apiUrl: s.apiUrl,
    workerKey: s.workerKey,
    limit: opts.limit || 40,
    delayMs: opts.delayMs || 2500,
    onLog: (msg) =>
      send("contribute:log", { msg, at: new Date().toISOString() }),
    onProgress: (p) => send("instagram:fill-progress", p),
  })
    .then((result) => {
      send("instagram:fill-done", result || {});
    })
    .catch((err) => {
      send("contribute:log", {
        msg: err instanceof Error ? err.message : String(err),
        at: new Date().toISOString(),
      });
      send("instagram:fill-done", { error: true });
    });

  return { ok: true };
});

ipcMain.handle("instagram:fill-stop", async () => {
  stopFillMissingEmails();
  return { ok: true };
});

ipcMain.handle("tabs:hide-browsers", async () => {
  hideBrowserTabs();
  return { ok: true };
});
