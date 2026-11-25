"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "influx_worker_key";
const DEFAULT_API =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://influencer-platform-mu.vercel.app";

interface ImportResult {
  ok?: boolean;
  error?: string;
  mode?: string;
  queued?: number;
  imported?: number;
  submitted?: number;
  already_saved?: number;
  already_pending?: number;
  failed?: number;
  message?: string;
  list_pages?: Array<{ url: string; count: number; error?: string }>;
  channels?: Array<{
    url: string;
    handle: string | null;
    title: string | null;
    status: string;
  }>;
}

export default function ImportPage() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API);
  const [workerKey, setWorkerKey] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setWorkerKey(saved);
  }, []);

  function saveKey() {
    localStorage.setItem(STORAGE_KEY, workerKey.trim());
  }

  async function submit() {
    setLoading(true);
    setResult(null);
    saveKey();
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/worker/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${workerKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "light",
          text,
          usa_only: true,
          min_subscribers: 0,
        }),
      });
      const data = (await res.json()) as ImportResult;
      if (!res.ok) {
        setResult({ error: data.error ?? "Import failed", list_pages: data.list_pages });
      } else {
        setResult(data);
      }
    } catch (err) {
      setResult({
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-xs font-semibold text-success">
          External list import · 0 YouTube API
        </p>
        <h1 className="h-page mt-1">Fast bulk, high quality</h1>
        <p className="page-subtitle">
          Paste roundup-page URLs or channel links. We extract creators and queue them with{" "}
          <strong className="font-medium text-fg">zero YouTube quota</strong>. USA filter +
          subscriber check run overnight when quota resets.
        </p>
      </div>

      <section className="rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-sm text-success/90">
        Works while quota is exhausted. Enrich later with{" "}
        <code className="rounded bg-fg/40 px-1.5 py-0.5 text-xs">
          npm run enrich:pending
        </code>
        .
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="h-section">Connection</h2>
        <label className="block text-xs font-medium text-muted">
          API URL
          <input
            className="input-field mt-1"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-muted">
          Worker key (iw_… from admin)
          <input
            type="password"
            className="input-field mt-1 text-sm"
            placeholder="iw_…"
            value={workerKey}
            onChange={(e) => setWorkerKey(e.target.value)}
          />
        </label>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="h-section">List pages or channel links</h2>
        <p className="text-xs text-muted">
          One per line. Mix blog roundups and YouTube URLs — up to 10 list pages per submit.
        </p>
        <textarea
          className="input-field min-h-[180px] text-sm"
          placeholder={`https://vidpros.com/best-personal-finance-youtube-channels/\nhttps://www.youtube.com/@GrahamStephan\n@ramitsethi`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || !text.trim() || !workerKey.trim()}
          className="btn-primary w-full"
        >
          {loading ? "Extracting & queueing…" : "Queue to pending (0 API)"}
        </button>
      </section>

      {result?.error && (
        <div
          className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {result.error}
        </div>
      )}

      {result?.ok && (
        <div className="card space-y-3 p-6">
          <p className="text-sm text-success">{result.message}</p>
          <ul className="text-xs text-muted">
            <li>Mode: {result.mode ?? "light"} (no YouTube API)</li>
            <li>Submitted: {result.submitted ?? 0}</li>
            <li>Queued: {result.queued ?? 0}</li>
            <li>Already saved: {result.already_saved ?? 0}</li>
            <li>Already pending: {result.already_pending ?? 0}</li>
            <li>Failed: {result.failed ?? 0}</li>
          </ul>
          {result.list_pages && result.list_pages.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-muted">
              <p className="font-medium text-fg">Pages scraped</p>
              {result.list_pages.map((p) => (
                <p key={p.url}>
                  {p.error
                    ? `✗ ${p.url} — ${p.error}`
                    : `✓ ${p.count} channels from ${p.url}`}
                </p>
              ))}
            </div>
          )}
          {result.channels && result.channels.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-fg">
              {result.channels.map((ch) => (
                <li key={ch.url}>
                  {ch.handle || ch.title || ch.url}
                  <span className="text-muted"> · {ch.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
