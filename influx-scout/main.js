const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { ScoutEngine, NICHE_QUERIES } = require("./engine/scout");

let mainWindow = null;
let engine = null;

function loadOwnerConfig() {
  try {
    const cfg = require("./engine/owner-config");
    const supabaseUrl = String(cfg.supabaseUrl || "").replace(/\/$/, "");
    const supabaseKey = String(cfg.supabaseKey || "");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("empty");
    }
    return { supabaseUrl, supabaseKey };
  } catch {
    throw new Error(
      "Owner DB config missing. On the build machine run: npm run bake (needs .env.local)"
    );
  }
}

function settingsPath() {
  return path.join(app.getPath("userData"), "scout-settings.json");
}

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    // Never expose baked DB keys to the renderer / disk UI state
    return {
      youtubeKey: String(raw.youtubeKey || ""),
      niche: raw.niche || "fitness",
      window: raw.window || "month",
      target: raw.target || 250,
      includeComments: Boolean(raw.includeComments),
      hardQuality: raw.hardQuality !== false,
      untilQuota: raw.untilQuota !== false,
      rotateNiches: Boolean(raw.rotateNiches),
      minSubs: raw.minSubs ?? 1000,
      minVideos: raw.minVideos ?? 3,
      customQuery: String(raw.customQuery || ""),
    };
  } catch {
    return {
      youtubeKey: "",
      niche: "fitness",
      window: "month",
      target: 250,
      includeComments: false,
      hardQuality: true,
      untilQuota: true,
      rotateNiches: true,
      minSubs: 1000,
      minVideos: 3,
      customQuery: "",
    };
  }
}

function saveSettings(raw) {
  const cleaned = {
    youtubeKey: String(raw.youtubeKey || "").trim(),
    niche: String(raw.niche || "fitness").trim(),
    window: ["week", "month", "any"].includes(raw.window)
      ? raw.window
      : "month",
    target: Math.max(50, Math.min(5000, parseInt(raw.target, 10) || 250)),
    includeComments: Boolean(raw.includeComments),
    hardQuality: raw.hardQuality !== false && raw.hardQuality !== "false",
    untilQuota: raw.untilQuota !== false && raw.untilQuota !== "false",
    rotateNiches: Boolean(raw.rotateNiches),
    minSubs: Math.max(0, parseInt(raw.minSubs, 10) || 1000),
    minVideos: Math.max(0, parseInt(raw.minVideos, 10) || 3),
    customQuery: String(raw.customQuery || "").trim(),
  };
  fs.writeFileSync(settingsPath(), JSON.stringify(cleaned, null, 2), "utf8");
  return cleaned;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: "Influx Scout",
    backgroundColor: "#0a0f0c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (engine?.running) engine.stop();
  });
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("settings:get", () => loadSettings());
ipcMain.handle("settings:save", (_e, s) => saveSettings(s));
ipcMain.handle("niches:list", () => Object.keys(NICHE_QUERIES));

ipcMain.handle("scout:start", async (_e, overrides = {}) => {
  const settings = { ...loadSettings(), ...overrides };
  saveSettings(settings);
  if (engine?.running) return { ok: false, error: "Already running" };

  let owner;
  try {
    owner = loadOwnerConfig();
  } catch (err) {
    return { ok: false, error: err.message };
  }

  engine = new ScoutEngine({
    onLog: (row) => send("scout:log", row),
    onStats: (stats) => send("scout:stats", stats),
    onDone: (stats) => send("scout:done", stats),
  });

  send("scout:started", {});
  // Don't await — run in background
  engine
    .run(
      {
        youtubeKey: settings.youtubeKey,
        supabaseUrl: owner.supabaseUrl,
        supabaseKey: owner.supabaseKey,
      },
      {
        niche: settings.niche,
        window: settings.window,
        target: settings.target,
        untilQuota: settings.untilQuota,
        rotateNiches: settings.rotateNiches,
        includeComments: settings.includeComments,
        hardQuality: settings.hardQuality,
        minSubs: settings.minSubs ?? 1000,
        minVideos: settings.minVideos ?? 3,
        customQuery: settings.customQuery,
      }
    )
    .catch((err) => {
      send("scout:log", {
        level: "error",
        message: err.message || String(err),
        at: new Date().toISOString(),
      });
      send("scout:done", engine.stats);
    });

  return { ok: true };
});

ipcMain.handle("scout:stop", () => {
  if (engine) engine.stop();
  return { ok: true };
});

ipcMain.handle("scout:status", () => ({
  running: Boolean(engine?.running),
  stats: engine?.stats || null,
}));
