const $ = (id) => document.getElementById(id);

function appendLog(row) {
  const box = $("logBox");
  const line = document.createElement("p");
  line.className = `log-line ${row.level || "info"}`;
  const t = row.at ? new Date(row.at).toLocaleTimeString() : "";
  line.textContent = `${t}  ${row.message}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function setRunning(on) {
  $("runState").textContent = on ? "Running" : "Idle";
  $("runState").classList.toggle("on", on);
  $("btnStart").disabled = on;
  $("btnStop").disabled = !on;
}

function syncTargetEnabled() {
  const until = $("untilQuota").checked;
  $("target").disabled = until;
  $("niche").disabled = $("rotateNiches").checked && !$("customQuery").value.trim();
}

function updateStats(s) {
  if (!s) return;
  $("sFound").textContent = s.found ?? 0;
  $("sUpserted").textContent = s.upserted ?? 0;
  $("sPass").textContent = s.qualityPass ?? 0;
  $("sFail").textContent = s.qualityFail ?? 0;
  $("sComments").textContent = s.comments ?? 0;
  $("sDepth").textContent = s.nicheDepth ?? 0;
  const depth = s.nicheDepth || 0;
  if (s.untilQuota || !s.target) {
    $("depthFill").style.width = "100%";
    $("depthFill").style.opacity = "0.55";
    const niche = s.currentNiche ? ` · ${s.currentNiche}` : "";
    $("depthText").textContent = `${depth} channels${niche} · until quota`;
  } else {
    $("depthFill").style.opacity = "1";
    const target = s.target || 250;
    const pct = Math.min(100, Math.round((depth / target) * 100));
    $("depthFill").style.width = `${pct}%`;
    $("depthText").textContent = `${depth} / ${target}`;
  }
}

function readForm() {
  return {
    youtubeKey: $("youtubeKey").value.trim(),
    niche: $("niche").value,
    window: $("window").value,
    target: parseInt($("target").value, 10) || 250,
    untilQuota: $("untilQuota").checked,
    rotateNiches: $("rotateNiches").checked,
    includeComments: $("includeComments").checked,
    hardQuality: $("hardQuality").checked,
    customQuery: $("customQuery").value.trim(),
  };
}

function fillForm(s) {
  $("youtubeKey").value = s.youtubeKey || "";
  $("niche").value = s.niche || "fitness";
  $("window").value = s.window || "month";
  $("target").value = s.target || 250;
  $("untilQuota").checked = s.untilQuota !== false;
  $("rotateNiches").checked = s.rotateNiches !== false;
  $("includeComments").checked = Boolean(s.includeComments);
  $("hardQuality").checked = s.hardQuality !== false;
  $("customQuery").value = s.customQuery || "";
  syncTargetEnabled();
}

async function init() {
  const niches = await window.scout.listNiches();
  const sel = $("niche");
  for (const n of niches) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    sel.appendChild(opt);
  }

  const settings = await window.scout.getSettings();
  fillForm(settings);

  $("untilQuota").addEventListener("change", syncTargetEnabled);
  $("rotateNiches").addEventListener("change", syncTargetEnabled);
  $("customQuery").addEventListener("input", syncTargetEnabled);

  window.scout.onLog(appendLog);
  window.scout.onStats(updateStats);
  window.scout.onStarted(() => {
    setRunning(true);
    appendLog({ level: "info", message: "Scout started", at: new Date().toISOString() });
  });
  window.scout.onDone((stats) => {
    setRunning(false);
    updateStats(stats);
    appendLog({
      level: stats?.quotaHit ? "warn" : "info",
      message: stats?.quotaHit
        ? "Finished — quota hit. Try another day."
        : "Scout finished",
      at: new Date().toISOString(),
    });
  });

  $("btnSave").addEventListener("click", async () => {
    await window.scout.saveSettings(readForm());
    appendLog({
      level: "info",
      message: "Settings saved",
      at: new Date().toISOString(),
    });
  });

  $("btnStart").addEventListener("click", async () => {
    const form = readForm();
    if (!form.youtubeKey) {
      appendLog({
        level: "error",
        message: "Paste your YouTube API key first",
        at: new Date().toISOString(),
      });
      return;
    }
    $("logBox").innerHTML = "";
    updateStats({
      found: 0,
      upserted: 0,
      qualityPass: 0,
      qualityFail: 0,
      comments: 0,
      nicheDepth: 0,
      target: form.untilQuota ? 0 : form.target,
      untilQuota: form.untilQuota,
    });
    const res = await window.scout.start(form);
    if (!res.ok) {
      appendLog({
        level: "error",
        message: res.error || "Could not start",
        at: new Date().toISOString(),
      });
    }
  });

  $("btnStop").addEventListener("click", () => window.scout.stop());
}

init().catch((err) => {
  appendLog({
    level: "error",
    message: err.message || String(err),
    at: new Date().toISOString(),
  });
});
