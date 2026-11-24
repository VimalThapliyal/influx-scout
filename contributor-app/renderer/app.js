const $ = (id) => document.getElementById(id);

function appendLog(line) {
  const el = $("log");
  const t = line.at ? new Date(line.at).toLocaleTimeString() : "";
  el.textContent += `${t ? `[${t}] ` : ""}${line.msg}\n`;
  el.scrollTop = el.scrollHeight;
}

async function load() {
  const s = await window.influx.getSettings();
  $("apiUrl").value = s.apiUrl || "https://influencer-platform-mu.vercel.app";
  $("workerKey").value = s.workerKey || "";
  $("youtubeKey").value = s.youtubeKey || "";
}

async function save() {
  await window.influx.saveSettings({
    apiUrl: $("apiUrl").value.trim(),
    workerKey: $("workerKey").value.trim(),
    youtubeKey: $("youtubeKey").value.trim(),
  });
  $("saveMsg").textContent = "Saved — used by Dashboard + YouTube + Instagram.";
  setTimeout(() => {
    $("saveMsg").textContent = "";
  }, 2500);
}

async function refreshStatus() {
  try {
    await save();
    const st = await window.influx.fetchStatus();
    $("seedsAvailable").textContent = String(st.seeds?.available ?? "—");
    $("pendingUnclaimed").textContent = String(st.pending?.unclaimed ?? "—");
    appendLog({
      msg: `Pool: ${st.seeds?.available ?? 0} seeds · ${st.pending?.unclaimed ?? 0} pending · worker ${st.worker?.name || "?"}`,
      at: new Date().toISOString(),
    });
  } catch (err) {
    appendLog({
      msg: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    });
  }
}

function setRunning(running) {
  $("startBtn").disabled = running;
  $("stopBtn").disabled = !running;
  $("runState").textContent = running ? "Running" : "Idle";
  $("runState").classList.toggle("running", running);
  const pill = $("runPill");
  pill.textContent = running ? "Loop on" : "Idle";
  pill.classList.toggle("running", running);
}

function setIgFillRunning(running) {
  $("igFillBtn").disabled = running;
  $("igFillStopBtn").disabled = !running;
  $("igFillState").textContent = running ? "Filling…" : "Idle";
  $("igFillState").classList.toggle("running", running);
}

async function switchTab(name) {
  document.querySelectorAll(".tab").forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  $("panel-dashboard").classList.toggle("active", name === "dashboard");
  $("panel-youtube").classList.toggle("active", name === "youtube");
  $("panel-instagram").classList.toggle("active", name === "instagram");
  $("panel-about").classList.toggle("active", name === "about");

  if (name === "youtube") {
    await save();
    try {
      await window.influx.showYouTubeTab();
    } catch (err) {
      appendLog({
        msg: err instanceof Error ? err.message : String(err),
        at: new Date().toISOString(),
      });
      switchTab("dashboard");
    }
  } else if (name === "instagram") {
    await save();
    try {
      await window.influx.showInstagramTab();
    } catch (err) {
      appendLog({
        msg: err instanceof Error ? err.message : String(err),
        at: new Date().toISOString(),
      });
      switchTab("dashboard");
    }
  } else {
    await window.influx.hideBrowsers();
    if (name === "dashboard" && $("cqList").children.length) {
      loadCaptchaQueue().catch(() => {});
    }
  }
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

$("saveBtn").addEventListener("click", () => save());
$("statusBtn").addEventListener("click", () => refreshStatus());
$("startBtn").addEventListener("click", async () => {
  await save();
  try {
    await window.influx.start();
  } catch (err) {
    appendLog({
      msg: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    });
  }
});
$("stopBtn").addEventListener("click", () => window.influx.stop());

$("igFillBtn").addEventListener("click", async () => {
  await save();
  try {
    // Open IG tab so user can see progress / finish login if needed
    await switchTab("instagram");
    const res = await window.influx.startIgFill({ limit: 40, delayMs: 2500 });
    if (res && res.error) {
      appendLog({ msg: res.error, at: new Date().toISOString() });
    }
  } catch (err) {
    appendLog({
      msg: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    });
  }
});
$("igFillStopBtn").addEventListener("click", () => window.influx.stopIgFill());

function formatSubs(n) {
  if (n == null || n === "") return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${Math.round(x / 1_000)}K`;
  return String(x);
}

function renderCaptchaQueue(data) {
  const list = $("cqList");
  const channels = data.channels || [];
  $("cqMeta").textContent = `Showing ${channels.length} of ~${data.total ?? "?"} with no email`;

  if (!channels.length) {
    list.innerHTML =
      '<div class="queue-empty">No channels match. Try unchecking “No website/IG” or lower min subs.</div>';
    return;
  }

  list.innerHTML = "";
  channels.forEach((ch) => {
    const row = document.createElement("div");
    row.className = "queue-row";
    row.dataset.channelId = ch.id;
    row.setAttribute("role", "listitem");
    row.innerHTML = `
      <div>
        <span class="queue-title"></span>
        <span class="queue-meta"></span>
      </div>
      <div class="queue-actions">
        <button type="button" class="btn-about">Open About</button>
        <button type="button" class="btn-skip" title="No captcha / no public email">No email</button>
      </div>
    `;
    row.querySelector(".queue-title").textContent = ch.title || ch.handle || ch.id;
    row.querySelector(".queue-meta").textContent = [
      ch.handle || "",
      formatSubs(ch.subscriber_count) + " subs",
      ch.has_website ? "site" : "",
      ch.has_instagram ? "IG" : "",
    ]
      .filter(Boolean)
      .join(" · ");

    row.querySelector(".btn-about").addEventListener("click", async () => {
      await save();
      try {
        document.querySelectorAll(".tab").forEach((btn) => {
          const on = btn.dataset.tab === "youtube";
          btn.classList.toggle("active", on);
          btn.setAttribute("aria-selected", on ? "true" : "false");
        });
        $("panel-dashboard").classList.remove("active");
        $("panel-youtube").classList.add("active");
        $("panel-instagram").classList.remove("active");
        await window.influx.openYouTubeAbout({
          about_url: ch.about_url,
          id: ch.id,
          handle: ch.handle,
          title: ch.title,
        });
        appendLog({
          msg: `About opened for ${ch.title || ch.handle}. Solve captcha → Scan / paste → Save.`,
          at: new Date().toISOString(),
        });
      } catch (err) {
        appendLog({
          msg: err instanceof Error ? err.message : String(err),
          at: new Date().toISOString(),
        });
      }
    });

    row.querySelector(".btn-skip").addEventListener("click", async () => {
      await save();
      try {
        await window.influx.skipCaptchaQueue({
          channel_id: ch.id,
          handle: ch.handle,
          reason: "no_public_email",
        });
        row.remove();
        appendLog({
          msg: `Marked no email: ${ch.title || ch.handle} — removed from queue`,
          at: new Date().toISOString(),
        });
        const left = $("cqList").querySelectorAll(".queue-row").length;
        $("cqMeta").textContent = `Showing ${left} left on this page (reload for more)`;
      } catch (err) {
        appendLog({
          msg: err instanceof Error ? err.message : String(err),
          at: new Date().toISOString(),
        });
      }
    });

    list.appendChild(row);
  });
}

async function loadCaptchaQueue() {
  await save();
  $("cqMeta").textContent = "Loading…";
  $("cqList").innerHTML = '<div class="queue-empty">Loading queue…</div>';
  try {
    const data = await window.influx.fetchCaptchaQueue({
      limit: 40,
      noLinks: $("cqNoLinks").checked,
      minSubs: Number($("cqMinSubs").value) || 0,
    });
    renderCaptchaQueue(data);
    appendLog({
      msg: `Captcha queue loaded: ${data.channels?.length || 0} rows (total ~${data.total ?? "?"})`,
      at: new Date().toISOString(),
    });
  } catch (err) {
    $("cqMeta").textContent = "";
    $("cqList").innerHTML = `<div class="queue-empty">${
      err instanceof Error ? err.message : String(err)
    }</div>`;
    appendLog({
      msg: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    });
  }
}

$("cqLoadBtn").addEventListener("click", () => loadCaptchaQueue());

window.influx.onLog((line) => appendLog(line));
window.influx.onStats((stats) => {
  $("statQueued").textContent = String(stats.channelsQueued || 0);
  $("statEnriched").textContent = String(stats.enriched || 0);
  $("statIgEmails").textContent = String(stats.instagramEmails || 0);
  $("statIgTried").textContent = String(stats.instagramTried || 0);
});
window.influx.onStarted(() => setRunning(true));
window.influx.onStopped(() => setRunning(false));
window.influx.onIgFillStarted(() => setIgFillRunning(true));
window.influx.onIgFillDone((result) => {
  setIgFillRunning(false);
  if (result && result.found != null) {
    appendLog({
      msg: `IG fill finished — found ${result.found}, tried ${result.tried}, skipped ${result.skipped}`,
      at: new Date().toISOString(),
    });
  }
});

load().then(() => {
  const verEl = $("appVersion");
  if (verEl) verEl.textContent = "1.2.9";
  appendLog({
    msg: "Ready. 1) Save keys  2) Start loop  3) Collect emails (captcha queue or Instagram).",
    at: new Date().toISOString(),
  });
});
