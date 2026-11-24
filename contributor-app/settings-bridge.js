const http = require("http");

const PORT = 17341;
let server = null;

/**
 * Tiny loopback server so the Chrome extension can pull the same
 * apiUrl + workerKey the Electron app is using.
 */
function startSettingsBridge(getSettings) {
  if (server) return PORT;

  server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url && req.url.startsWith("/influx-settings")) {
      const s = getSettings() || {};
      const body = JSON.stringify({
        ok: true,
        source: "influx-contributor-app",
        apiUrl: s.apiUrl || "https://influencer-platform-mu.vercel.app",
        workerKey: s.workerKey || "",
        usaOnly: true,
        lightSave: true,
        relatedCrawl: true,
        minSubscribers: 1000,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not found" }));
  });

  server.listen(PORT, "127.0.0.1");
  return PORT;
}

function stopSettingsBridge() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { startSettingsBridge, stopSettingsBridge, PORT };
