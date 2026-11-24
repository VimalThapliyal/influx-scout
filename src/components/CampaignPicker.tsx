"use client";

import { useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";
import { SignInToSaveBanner } from "@/components/SignInToSaveBanner";

export interface CampaignMembership {
  influencer_id: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  email_sent_at: string | null;
}

export function CampaignPicker({
  channelId,
  onAdded,
  submitLabel = "Add to list",
}: {
  channelId: string;
  onAdded: (membership: CampaignMembership) => void;
  submitLabel?: string;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => {
        setCampaigns(d.campaigns ?? []);
        setRequiresAuth(d.requiresAuth === true);
      });
  }, []);

  async function addToCampaign(campaignId: string, campaignName: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_ids: [channelId] }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setRequiresAuth(true);
        throw new Error(data.error ?? "Sign in required");
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to add");

      const influencer = data.influencers?.[0];
      onAdded({
        influencer_id: influencer?.id ?? "",
        campaign_id: campaignId,
        campaign_name: campaignName,
        status: influencer?.status ?? "identified",
        email_sent_at: influencer?.email_sent_at ?? null,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setLoading(false);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setLoading(true);
    setMessage(null);
    try {
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
        }),
      });
      const campaign = await createRes.json();
      if (createRes.status === 401) {
        setRequiresAuth(true);
        throw new Error(campaign.error ?? "Sign in required");
      }
      if (!createRes.ok) throw new Error(campaign.error ?? "Failed to create list");

      setNewName("");
      setNewDescription("");
      setShowCreate(false);
      setCampaigns((prev) => [campaign, ...prev]);
      await addToCampaign(campaign.id, campaign.name);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create list");
      setLoading(false);
    }
  }

  if (requiresAuth) {
    return <SignInToSaveBanner compact />;
  }

  return (
    <div className="space-y-3">
      {campaigns.length > 0 && (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {campaigns.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={loading}
                onClick={() => addToCampaign(c.id, c.name)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm transition hover:border-mkt-tally/40 hover:bg-mkt-tally/10 disabled:opacity-50"
              >
                <span className="font-medium text-white">{c.name}</span>
                {c.description && (
                  <span className="mt-0.5 block text-xs text-slate-500">{c.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {campaigns.length === 0 && !showCreate && (
        <p className="text-sm text-slate-500">No lists yet. Create one below to track outreach.</p>
      )}

      {showCreate ? (
        <form onSubmit={createAndAdd} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <input
            type="text"
            className="input-field"
            placeholder="List name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />
          <input
            type="text"
            className="input-field"
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? "Creating…" : "Create & add"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreate(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="w-full rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm font-medium text-mkt-tally transition hover:border-mkt-tally/40 hover:bg-mkt-tally/5"
        >
          + Create new list
        </button>
      )}

      {message && (
        <p className="text-sm text-red-400" role="alert">
          {message}
        </p>
      )}

      {!showCreate && campaigns.length > 0 && (
        <p className="text-center text-xs text-slate-600">{submitLabel}</p>
      )}
    </div>
  );
}
