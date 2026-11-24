"use client";

import { useEffect, useState } from "react";
import { CampaignPicker } from "@/components/CampaignPicker";

export function SaveToCampaignModal({
  channelId,
  channelTitle,
  open,
  onClose,
  onSaved,
}: {
  channelId: string;
  channelTitle: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) setSaved(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="card w-full max-w-md p-6 shadow-2xl shadow-mkt-tally/10"
        role="dialog"
        aria-labelledby="save-title"
      >
        <h2 id="save-title" className="font-display text-lg font-semibold text-white">
          Add to campaign list
        </h2>
        <p className="mt-1 text-sm text-slate-500">{channelTitle}</p>
        <p className="mt-2 text-xs text-slate-600">
          Pick an existing list or create a new one — then track outreach from Campaigns.
        </p>

        {saved ? (
          <p className="mt-4 text-sm text-emerald-400">Added to list successfully.</p>
        ) : (
          <div className="mt-4">
            <CampaignPicker
              channelId={channelId}
              onAdded={() => {
                setSaved(true);
                onSaved?.();
                setTimeout(onClose, 1200);
              }}
            />
          </div>
        )}

        <button type="button" onClick={onClose} className="btn-secondary mt-4 w-full">
          {saved ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
