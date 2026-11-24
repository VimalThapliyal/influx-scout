"use client";

import { useEffect, useState } from "react";
import type { CampaignInfluencer, InfluencerStatus } from "@/lib/types";

const STATUSES: { value: InfluencerStatus; label: string }[] = [
  { value: "identified", label: "Identified" },
  { value: "contacted", label: "Contacted" },
  { value: "negotiating", label: "Negotiating" },
  { value: "contracted", label: "Contracted" },
  { value: "completed", label: "Completed" },
];

export function CampaignTrackingModal({
  influencer,
  creatorName,
  open,
  onClose,
  onSaved,
}: {
  influencer: CampaignInfluencer;
  creatorName: string;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: CampaignInfluencer) => void;
}) {
  const [status, setStatus] = useState<InfluencerStatus>(influencer.status);
  const [notes, setNotes] = useState(influencer.notes ?? "");
  const [replied, setReplied] = useState(influencer.replied);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus(influencer.status);
    setNotes(influencer.notes ?? "");
    setReplied(influencer.replied);
    setError(null);
  }, [open, influencer]);

  async function save(overrides?: Partial<{ status: InfluencerStatus; replied: boolean; mark_contacted: boolean }>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/influencers/${influencer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: overrides?.status ?? status,
          notes,
          replied: overrides?.replied ?? replied,
          mark_contacted: overrides?.mark_contacted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const lastContact = influencer.email_sent_at
    ? new Date(influencer.email_sent_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="card w-full max-w-lg overflow-hidden shadow-2xl shadow-mkt-tally/10" role="dialog">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-mkt-tally">Track outreach</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-white">{creatorName}</h2>
              {lastContact && (
                <p className="mt-1 text-xs text-slate-500">Last contacted: {lastContact}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Pipeline status</label>
            <select
              className="input-field"
              value={status}
              onChange={(e) => setStatus(e.target.value as InfluencerStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value} className="bg-[#0f172a]">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <input
              type="checkbox"
              checked={replied}
              onChange={(e) => setReplied(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/10 text-mkt-tally focus:ring-mkt-tally/30"
            />
            <div>
              <p className="text-sm font-medium text-white">Creator replied</p>
              <p className="text-xs text-slate-500">Mark when you receive a response</p>
            </div>
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
            <textarea
              className="input-field min-h-[100px] resize-y"
              placeholder="Follow-up details, budget discussed, next steps…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary flex-1 text-sm"
              disabled={saving}
              onClick={() => save({ mark_contacted: true, status: "contacted" })}
            >
              Mark contacted today
            </button>
            <button type="button" className="btn-primary flex-1" disabled={saving} onClick={() => save()}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PipelineSummary({
  influencers,
}: {
  influencers: CampaignInfluencer[];
}) {
  const statusCounts: Record<InfluencerStatus, number> = {
    identified: 0,
    contacted: 0,
    negotiating: 0,
    contracted: 0,
    completed: 0,
  };
  let replied = 0;

  for (const inf of influencers) {
    statusCounts[inf.status]++;
    if (inf.replied) replied++;
  }

  const items = [
    { label: "Identified", value: statusCounts.identified, color: "text-slate-400" },
    { label: "Contacted", value: statusCounts.contacted, color: "text-mkt-tally" },
    { label: "Negotiating", value: statusCounts.negotiating, color: "text-amber-300" },
    { label: "Contracted", value: statusCounts.contracted, color: "text-emerald-300" },
    { label: "Replied", value: replied, color: "text-cyan-300" },
  ];

  return (
    <div className="flex flex-wrap gap-3 border-b border-white/10 px-6 py-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          <span className={`font-semibold ${item.color}`}>{item.value}</span>
          <span className="text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    identified: "bg-slate-500/20 text-slate-400",
    contacted: "bg-mkt-tally/20 text-mkt-tally",
    negotiating: "bg-amber-500/20 text-amber-300",
    contracted: "bg-emerald-500/20 text-emerald-300",
    completed: "bg-emerald-500/20 text-emerald-400",
  };
  return (
    <span className={`inline-flex rounded-lg px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] ?? colors.identified}`}>
      {status}
    </span>
  );
}
