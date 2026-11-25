"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-fg/40 p-4 sm:items-center">
      <div className="card w-full max-w-lg overflow-hidden shadow-pop" role="dialog"
        aria-modal="true">
        <div className="border-b border-line px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="h-section">{creatorName}</h2>
              {lastContact && (
                <p className="mt-1 text-xs text-muted">Last contacted: {lastContact}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Pipeline status</label>
            <select
              className="input-field"
              value={status}
              onChange={(e) => setStatus(e.target.value as InfluencerStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value} className="bg-surface">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-subtle px-4 py-3">
            <input
              type="checkbox"
              checked={replied}
              onChange={(e) => setReplied(e.target.checked)}
              className="h-4 w-4 rounded border-line bg-subtle text-accent focus:ring-accent/30"
            />
            <div>
              <p className="text-sm font-medium text-fg">Creator replied</p>
              <p className="text-xs text-muted">Mark when you receive a response</p>
            </div>
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Notes</label>
            <textarea
              className="input-field min-h-[100px] resize-y"
              placeholder="Follow-up details, budget discussed, next steps…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {error && (
            <p className="text-sm text-danger" role="alert">{error}</p>
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
              {saving ? "Saving" : "Save"}
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
    { label: "Identified", value: statusCounts.identified },
    { label: "Contacted", value: statusCounts.contacted },
    { label: "Replied", value: replied },
    { label: "Negotiating", value: statusCounts.negotiating },
    { label: "Contracted", value: statusCounts.contracted },
  ];

  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line px-4 py-2.5 text-[0.8125rem]">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <dd className="font-semibold tabular-nums text-fg">{item.value}</dd>
          <dt className="text-muted">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    identified: "bg-subtle text-muted",
    contacted: "bg-accent-soft text-accent",
    negotiating: "bg-warn-soft text-warn",
    contracted: "bg-success-soft text-success",
    completed: "bg-success-soft text-success",
  };
  return (
    <span className={`tag-pill capitalize ${colors[status] ?? colors.identified}`}>
      {status}
    </span>
  );
}
