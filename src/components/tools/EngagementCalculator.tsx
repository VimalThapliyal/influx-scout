"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface TierBenchmark {
  tier: string;
  label: string;
  min: number;
  sample: number;
  p25: number;
  median: number;
  p75: number;
}

function num(v: string): number {
  const n = Number(v.replace(/[, ]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function tierFor(subs: number, tiers: TierBenchmark[]): TierBenchmark | null {
  if (subs <= 0) return null;
  return [...tiers].reverse().find((t) => subs >= t.min) ?? tiers[0] ?? null;
}

export function EngagementCalculator({ tiers }: { tiers: TierBenchmark[] }) {
  const [views, setViews] = useState("25000");
  const [likes, setLikes] = useState("900");
  const [comments, setComments] = useState("120");
  const [subs, setSubs] = useState("50000");

  const result = useMemo(() => {
    const v = num(views);
    if (v <= 0) return null;
    const rate = ((num(likes) + num(comments)) / v) * 100;
    const tier = tierFor(num(subs), tiers);
    let verdict: { label: string; tone: string } | null = null;
    if (tier) {
      if (rate >= tier.p75) verdict = { label: "Excellent — top 25% for this size", tone: "text-success" };
      else if (rate >= tier.median) verdict = { label: "Above average for this size", tone: "text-success" };
      else if (rate >= tier.p25) verdict = { label: "Below average for this size", tone: "text-accent" };
      else verdict = { label: "Low — bottom 25% for this size", tone: "text-danger" };
    }
    return { rate, tier, verdict };
  }, [views, likes, comments, subs, tiers]);

  const field = (label: string, value: string, set: (v: string) => void, hint?: string) => (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => set(e.target.value)}
        className="input-field mt-1 w-full"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card space-y-4 p-6">
        {field("Views", views, setViews, "Total views of the video(s) you're measuring")}
        {field("Likes", likes, setLikes)}
        {field("Comments", comments, setComments)}
        {field("Channel subscribers", subs, setSubs, "Used to compare against creators of the same size")}
      </div>

      <div className="card flex flex-col justify-center p-6 text-center">
        <p className="text-xs text-muted">Engagement rate</p>
        <p className="mt-2 text-6xl text-fg">
          {result ? `${result.rate.toFixed(2)}%` : "—"}
        </p>
        {result?.verdict && <p className={`mt-3 text-sm font-medium ${result.verdict.tone}`}>{result.verdict.label}</p>}
        {result?.tier && (
          <p className="mt-2 text-xs text-muted">
            {result.tier.label} subscriber channels: median {result.tier.median}% · top 25% above {result.tier.p75}%
          </p>
        )}
        <Link href="/youtubers" className="btn-primary mt-6 inline-flex self-center">
          Find high-engagement creators
        </Link>
      </div>
    </div>
  );
}
