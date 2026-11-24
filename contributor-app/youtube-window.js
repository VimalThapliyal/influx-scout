const { BrowserView, session } = require("electron");
const path = require("path");
const fs = require("fs");

let youtubeView = null;
let loadedExtension = null;
let hostWindow = null;
let lastSettings = null;
const TAB_BAR_HEIGHT = 52;

function extensionDir(appRoot) {
  const packaged = path.join(process.resourcesPath || "", "extension");
  if (fs.existsSync(path.join(packaged, "manifest.json"))) return packaged;
  const local = path.join(appRoot, "extension");
  if (fs.existsSync(path.join(local, "manifest.json"))) return local;
  return null;
}

function layoutYouTubeView() {
  if (!youtubeView || !hostWindow || hostWindow.isDestroyed()) return;
  const [width, height] = hostWindow.getContentSize();
  youtubeView.setBounds({
    x: 0,
    y: TAB_BAR_HEIGHT,
    width,
    height: Math.max(100, height - TAB_BAR_HEIGHT),
  });
}

async function injectSettings(settings) {
  if (!youtubeView) return;
  const payload = {
    apiUrl: settings.apiUrl || "https://influencer-platform-mu.vercel.app",
    workerKey: settings.workerKey || "",
    usaOnly: true,
    minSubscribers: 1000,
    lightSave: true,
    relatedCrawl: true,
    autoDelayMs: 1000,
    autoRotate: true,
  };
  const json = JSON.stringify(payload);
  const boot = JSON.stringify({
    source: "influx-electron",
    type: "boot",
    settings: payload,
  });
  try {
    await youtubeView.webContents.executeJavaScript(
      `
      document.documentElement.setAttribute('data-influx-settings', ${JSON.stringify(json)});
      window.postMessage(${boot}, '*');
      true;
      `,
      true
    );
  } catch {
    /* navigating */
  }
}

/**
 * Attach YouTube BrowserView under the tab bar of the main window.
 */
async function attachYouTubeTab(mainWindow, opts) {
  const { appRoot, settings, onLog = () => {} } = opts;
  hostWindow = mainWindow;
  lastSettings = settings;

  const extPath = extensionDir(appRoot);
  if (!extPath) throw new Error("Bundled extension folder not found");

  const ses = session.fromPartition("persist:influx-youtube");

  if (!loadedExtension) {
    try {
      loadedExtension = await ses.loadExtension(extPath, {
        allowFileAccess: true,
      });
      onLog(`YouTube tab: extension loaded (${loadedExtension.id})`);
    } catch (err) {
      onLog(
        `YouTube tab: extension load issue (${err instanceof Error ? err.message : err}) — using DOM settings bridge`
      );
    }
  }

  if (!youtubeView) {
    youtubeView = new BrowserView({
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

  youtubeView.webContents.on("did-finish-load", () => {
    injectSettings(lastSettings || settings);
    setTimeout(() => injectSettings(lastSettings || settings), 400);
    setTimeout(() => injectSettings(lastSettings || settings), 1200);
    setTimeout(() => injectSettings(lastSettings || settings), 3000);
  });

  youtubeView.webContents.on("did-navigate-in-page", () => {
    injectSettings(lastSettings || settings);
  });

  youtubeView.webContents.on("did-navigate", () => {
    setTimeout(() => injectSettings(lastSettings || settings), 300);
  });

    const startSeeds = [
      "gaming usa",
      "beauty usa",
      "fitness usa",
      "tech reviews usa",
      "food usa",
      "travel usa",
      "parenting usa",
      "diy usa",
      "pets usa",
      "fashion usa",
      "education usa",
      "personal finance texas",
    ];
    const seed =
      startSeeds[Math.floor(Math.random() * startSeeds.length)] || "gaming usa";
    youtubeView.webContents
      .loadURL(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(seed)}&sp=EgIQAg%253D%253D`
      )
      .catch(() => {});
  }

  mainWindow.setBrowserView(youtubeView);
  layoutYouTubeView();

  const onResize = () => layoutYouTubeView();
  mainWindow.removeListener("resize", onResize);
  mainWindow.on("resize", onResize);

  await injectSettings(settings);
  onLog(
    "YouTube tab ready. Start auto-save skips recently used keywords (7–30 day cooldown) so it won’t loop finance usa forever."
  );

  return { ok: true };
}

function showYouTubeTab(mainWindow) {
  if (!youtubeView || !mainWindow || mainWindow.isDestroyed()) return false;
  hostWindow = mainWindow;
  mainWindow.setBrowserView(youtubeView);
  layoutYouTubeView();
  if (lastSettings) injectSettings(lastSettings);
  return true;
}

function hideYouTubeTab(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (youtubeView) {
    try {
      mainWindow.removeBrowserView(youtubeView);
    } catch {
      mainWindow.setBrowserView(null);
    }
  }
}

function updateYouTubeSettings(settings) {
  lastSettings = settings;
  return injectSettings(settings);
}

function destroyYouTubeTab(mainWindow) {
  hideYouTubeTab(mainWindow);
  if (youtubeView) {
    try {
      youtubeView.webContents.destroy();
    } catch {
      /* ignore */
    }
  }
  youtubeView = null;
}

async function navigateYouTubeTo(url, meta = null) {
  if (!youtubeView) throw new Error("YouTube tab not open yet");
  const target = String(url || "").trim();
  if (!/^https?:\/\/(www\.)?youtube\.com\//i.test(target)) {
    throw new Error("URL must be a youtube.com link");
  }
  await youtubeView.webContents.loadURL(target);
  if (meta && (meta.id || meta.handle)) {
    const payload = JSON.stringify({
      id: meta.id || null,
      handle: meta.handle || null,
      title: meta.title || null,
    });
    const inject = async () => {
      try {
        await youtubeView.webContents.executeJavaScript(
          `document.documentElement.setAttribute('data-influx-channel', ${JSON.stringify(payload)}); true;`,
          true
        );
      } catch {
        /* navigating */
      }
    };
    await inject();
    setTimeout(inject, 500);
    setTimeout(inject, 1500);
    setTimeout(inject, 3000);
  }
  return { ok: true, url: target };
}

module.exports = {
  attachYouTubeTab,
  showYouTubeTab,
  hideYouTubeTab,
  updateYouTubeSettings,
  destroyYouTubeTab,
  navigateYouTubeTo,
  TAB_BAR_HEIGHT,
};
