const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("scout", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (s) => ipcRenderer.invoke("settings:save", s),
  listNiches: () => ipcRenderer.invoke("niches:list"),
  start: (overrides) => ipcRenderer.invoke("scout:start", overrides),
  stop: () => ipcRenderer.invoke("scout:stop"),
  status: () => ipcRenderer.invoke("scout:status"),
  onLog: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on("scout:log", h);
    return () => ipcRenderer.removeListener("scout:log", h);
  },
  onStats: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on("scout:stats", h);
    return () => ipcRenderer.removeListener("scout:stats", h);
  },
  onStarted: (cb) => {
    const h = () => cb();
    ipcRenderer.on("scout:started", h);
    return () => ipcRenderer.removeListener("scout:started", h);
  },
  onDone: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on("scout:done", h);
    return () => ipcRenderer.removeListener("scout:done", h);
  },
});
