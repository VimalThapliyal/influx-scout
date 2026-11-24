const DEFAULT_API = "https://influencer-platform-mu.vercel.app";

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setChecked(id, checked) {
  const el = document.getElementById(id);
  if (el) el.checked = checked;
}

async function loadSettings() {
  // Prefer keys from Influx Contributor app if it's running
  try {
    await chrome.runtime.sendMessage({ type: "influx-sync-from-app" });
  } catch {
    /* app not running or old background */
  }

  const stored = await chrome.storage.sync.get({
    apiUrl: DEFAULT_API,
    workerKey: "",
    usaOnly: true,
    minSubscribers: 1000,
    autoDelayMs: 1000,
    autoRotate: true,
    lightSave: true,
    relatedCrawl: true,
  });

  const apiUrl = stored.apiUrl || DEFAULT_API;
  const workerKey = stored.workerKey || "";
  const usaOnly = stored.usaOnly !== false;
  const lightSave = stored.lightSave !== false;
  const relatedCrawl = stored.relatedCrawl !== false;
  const minSubs = parseInt(String(stored.minSubscribers ?? 1000), 10);
  const autoDelayMs = parseInt(String(stored.autoDelayMs ?? 1000), 10);
  const autoRotate = stored.autoRotate !== false;

  setValue("apiUrl", apiUrl);
  setValue("workerKey", workerKey);
  setChecked("usaOnly", usaOnly);
  setChecked("lightSave", lightSave);
  setChecked("relatedCrawl", relatedCrawl);
  setValue("minSubscribers", Number.isFinite(minSubs) && minSubs > 0 ? String(minSubs) : "");
  setValue("autoDelayMs", String(Number.isFinite(autoDelayMs) && autoDelayMs > 0 ? autoDelayMs : 1000));
  setChecked("autoRotate", autoRotate);

  refreshRelatedQueueStatus();
}

async function refreshRelatedQueueStatus() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "influx-related-status" });
    const el = document.getElementById("relatedStatus");
    if (el && res) {
      el.textContent =
        res.queueSize > 0
          ? `Related queue: ${res.queueSize} channel page(s) waiting`
          : "Related queue: empty";
    }
  } catch {
    /* ignore */
  }
}

document.getElementById("saveSettings").addEventListener("click", async () => {
  const apiUrl = document.getElementById("apiUrl").value.trim() || DEFAULT_API;
  const workerKey = document.getElementById("workerKey").value.trim();
  const usaOnly = document.getElementById("usaOnly").checked;
  const lightSave = document.getElementById("lightSave").checked;
  const relatedCrawl = document.getElementById("relatedCrawl").checked;
  const minRaw = document.getElementById("minSubscribers").value.trim();
  const minSubscribers = minRaw ? Math.max(0, parseInt(minRaw, 10) || 0) : 0;
  const autoDelayMs = Math.max(
    500,
    parseInt(document.getElementById("autoDelayMs").value.trim(), 10) || 1000
  );
  const autoRotate = document.getElementById("autoRotate").checked;
  await chrome.storage.sync.set({
    apiUrl,
    workerKey,
    usaOnly,
    lightSave,
    relatedCrawl,
    minSubscribers,
    autoDelayMs,
    autoRotate,
  });
  const status = document.getElementById("status");
  status.textContent = workerKey
    ? lightSave
      ? "Settings saved · light save ON (0 quota)."
      : "Settings saved · full API save ON."
    : "Add your worker key.";
  status.className = workerKey ? "ok" : "err";
});

document.getElementById("processRelated").addEventListener("click", async () => {
  const status = document.getElementById("status");
  try {
    const tab = await activeYoutubeTab();
    const res = await chrome.runtime.sendMessage({
      type: "influx-related-process-next",
      tabId: tab.id,
    });
    if (res?.empty) {
      status.textContent = "Related queue is empty. Save some channels first.";
      status.className = "err";
      return;
    }
    status.textContent = `Opening related page: ${res.url}`;
    status.className = "ok";
    refreshRelatedQueueStatus();
  } catch (err) {
    status.textContent = err.message || "Could not process related queue.";
    status.className = "err";
  }
});

document.getElementById("openImport").addEventListener("click", (e) => {
  e.preventDefault();
  const apiUrl = document.getElementById("apiUrl").value.trim() || DEFAULT_API;
  chrome.tabs.create({ url: `${apiUrl.replace(/\/$/, "")}/import` });
});

async function activeYoutubeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("youtube.com")) {
    throw new Error("Open a YouTube tab first.");
  }
  return tab;
}

async function sendAutoSaveMessage(type, extra = {}) {
  const tab = await activeYoutubeTab();
  return chrome.tabs.sendMessage(tab.id, { type, ...extra });
}

document.getElementById("startAutoSave").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const delayRaw = document.getElementById("autoDelayMs").value.trim();
  const delayMs = delayRaw ? Math.max(500, parseInt(delayRaw, 10) || 1000) : 1000;
  const rotateEnabled = document.getElementById("autoRotate").checked;
  try {
    const res = await sendAutoSaveMessage("influx-auto-save-start", {
      delayMs,
      rotateEnabled,
    });
    status.textContent = rotateEnabled
      ? `Auto-save started · rotates if mostly under min subs · ${res?.keyword || "youtube"}`
      : `Auto-save started (${delayMs}ms between clicks).`;
    status.className = "ok";
  } catch (err) {
    status.textContent = err.message || "Reload YouTube tab, then try again.";
    status.className = "err";
  }
});

document.getElementById("stopAutoSave").addEventListener("click", async () => {
  const status = document.getElementById("status");
  try {
    const res = await sendAutoSaveMessage("influx-auto-save-stop");
    status.textContent = `Stopped · ${res?.saved ?? 0} saved · ${res?.tooSmall ?? 0} too small · ${res?.rotations ?? 0} keyword switches`;
    status.className = "ok";
  } catch (err) {
    status.textContent = err.message || "Could not stop auto-save.";
    status.className = "err";
  }
});

loadSettings().catch((err) => {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = err instanceof Error ? err.message : "Could not load settings.";
    status.className = "err";
  }
});
