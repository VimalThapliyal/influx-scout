const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("influx", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (s) => ipcRenderer.invoke("settings:save", s),
  fetchStatus: () => ipcRenderer.invoke("status:fetch"),
  start: () => ipcRenderer.invoke("contribute:start"),
  stop: () => ipcRenderer.invoke("contribute:stop"),
  showYouTubeTab: () => ipcRenderer.invoke("youtube:show-tab"),
  hideYouTubeTab: () => ipcRenderer.invoke("youtube:hide-tab"),
  openYouTubeAbout: (url) => ipcRenderer.invoke("youtube:open-about", url),
  fetchCaptchaQueue: (opts) =>
    ipcRenderer.invoke("emails:captcha-queue", opts),
  skipCaptchaQueue: (payload) =>
    ipcRenderer.invoke("emails:captcha-skip", payload),
  showInstagramTab: () => ipcRenderer.invoke("instagram:show-tab"),
  hideInstagramTab: () => ipcRenderer.invoke("instagram:hide-tab"),
  hideBrowsers: () => ipcRenderer.invoke("tabs:hide-browsers"),
  startIgFill: (opts) => ipcRenderer.invoke("instagram:fill-start", opts),
  stopIgFill: () => ipcRenderer.invoke("instagram:fill-stop"),
  onLog: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("contribute:log", handler);
    return () => ipcRenderer.removeListener("contribute:log", handler);
  },
  onStats: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("contribute:stats", handler);
    return () => ipcRenderer.removeListener("contribute:stats", handler);
  },
  onStarted: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("contribute:started", handler);
    return () => ipcRenderer.removeListener("contribute:started", handler);
  },
  onStopped: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("contribute:stopped", handler);
    return () => ipcRenderer.removeListener("contribute:stopped", handler);
  },
  onIgFillStarted: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("instagram:fill-started", handler);
    return () => ipcRenderer.removeListener("instagram:fill-started", handler);
  },
  onIgFillDone: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("instagram:fill-done", handler);
    return () => ipcRenderer.removeListener("instagram:fill-done", handler);
  },
  onIgFillProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("instagram:fill-progress", handler);
    return () =>
      ipcRenderer.removeListener("instagram:fill-progress", handler);
  },
});
