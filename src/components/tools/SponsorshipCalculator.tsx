"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FORMAT_CPM, NICHE_MULTIPLIER } from "@/lib/sponsorship-pricing";

function num(v: string): number {
  const n = Number(v.replace(/[, ]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function SponsorshipCalculator() {
  const [views, setViews] = useState("40000");
  const [niche, setNiche] = useState("tech");
  const [format, setFormat] = useState("integration");

  const result = useMemo(() => {
    const v = num(views);
    if (v <= 0) return null;
    const f = FORMAT_CPM[format]!;
    const m = NICHE_MULTIPLIER.find((n) => n.value === niche)?.m ?? 1;
    // round to the nearest $10 so it doesn't look falsely precise
    const r = (x: number) => Math.max(10, Math.round(x / 10) * 10);
    return { low: r((v / 1000) * f.low * m), high: r((v / 1000) * f.high * m) };
  }, [views, niche, format]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card space-y-4 p-6">
        <label className="block">
          <span className="text-xs text-muted">Average views per video</span>
          <input inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value)} className="input-field mt-1 w-full" />
          <span className="mt-1 block text-xs text-muted">Use the average of recent videos, not subscribers</span>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Niche</span>
          <select value={niche} onChange={(e) => setNiche(e.target.value)} className="input-field mt-1 w-full">
            {NICHE_MULTIPLIER.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Sponsorship format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="input-field mt-1 w-full">
            {Object.entries(FORMAT_CPM).map(([k, f]) => (
              <option key={k} value={k}>{f.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="card flex flex-col justify-center p-6 text-center">
        <p className="text-xs text-muted">Estimated price per video</p>
        <p className="mt-2 text-5xl text-fg">
          {result ? `${usd(result.low)} – ${usd(result.high)}` : "—"}
        </p>
        <p className="mt-3 text-xs text-muted">
          Rough estimate from typical sponsorship CPMs. Real rates vary with audience, usage rights and
          deliverables — always confirm with the creator.
        </p>
        <Link href="/youtubers" className="btn-primary mt-6 inline-flex self-center">
          Find creators in your budget
        </Link>
      </div>
    </div>
  );
}
