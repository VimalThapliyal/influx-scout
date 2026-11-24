"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Campaign, CampaignInfluencer, Channel } from "@/lib/types";
import { LoadingSpinner } from "@/components/ui";
import { EmailGate } from "@/components/EmailGate";
import { EmailOutreachModal } from "@/components/EmailOutreachModal";
import { SignInToSaveBanner } from "@/components/SignInToSaveBanner";
import {
  CampaignTrackingModal,
  PipelineSummary,
  StatusBadge,
} from "@/components/CampaignTrackingModal";

interface CampaignWithInfluencers extends Campaign {
  influencers?: (CampaignInfluencer & { channel?: Channel })[];
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<CampaignWithInfluencers | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [outreachTarget, setOutreachTarget] = useState<{
    channel: Channel;
    influencerId: string;
  } | null>(null);
  const [trackingInfluencer, setTrackingInfluencer] = useState<
    (CampaignInfluencer & { channel?: Channel }) | null
  >(null);
  const [requiresAuth, setRequiresAuth] = useState(false);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      if (res.ok) {
        setCampaigns(data.campaigns ?? []);
        setRequiresAuth(data.requiresAuth === true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadCampaignDetail(id: string) {
    const res = await fetch(`/api/campaigns/${id}`);
    if (res.ok) setSelected(await res.json());
  }

  function handleInfluencerUpdated(updated: CampaignInfluencer) {
    setSelected((prev) => {
      if (!prev?.influencers) return prev;
      return {
        ...prev,
        influencers: prev.influencers.map((inf) =>
          inf.id === updated.id ? { ...inf, ...updated } : inf
        ),
      };
    });
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setRequiresAuth(true);
        throw new Error(data.error ?? "Sign in required");
      }
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setName("");
      setDescription("");
      setShowCreate(false);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-mkt-tally">Campaigns</p>
        <h1 className="page-title mt-1">Manage creator lists</h1>
        <p className="page-subtitle">Organize influencers into lists and track your outreach pipeline.</p>
      </div>

      {requiresAuth && <SignInToSaveBanner />}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="section-title">Outreach pipeline</h2>
            {selected && (
              <p className="mt-0.5 text-xs text-slate-500">{selected.name}</p>
            )}
          </div>
          <span className="text-xs text-slate-500">Select a list below to view creators</span>
        </div>

        {selected?.influencers && selected.influencers.length > 0 && (
          <PipelineSummary influencers={selected.influencers} />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-6 py-3">Creator</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last contact</th>
                <th className="px-4 py-3">Replied</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {selected?.influencers?.length ? (
                selected.influencers.map((inf) => (
                  <tr key={inf.id} className="table-row">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {inf.channel?.thumbnail_url && (
                          <img src={inf.channel.thumbnail_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium text-white">{inf.channel?.title ?? inf.channel_id}</span>
                          {inf.notes && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{inf.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={inf.status} />
                    </td>
                    <td className="px-4 py-4 text-slate-400">
                      {inf.email_sent_at
                        ? new Date(inf.email_sent_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-4">
                      {inf.replied ? (
                        <span className="text-xs font-medium text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-xs text-slate-600">No</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {inf.channel?.has_email || inf.channel?.email || inf.channel?.email_masked ? (
                        <EmailGate
                          email={inf.channel?.email}
                          maskedPreview={inf.channel?.email_masked}
                          locked={inf.channel?.email_locked}
                          showCopy
                        />
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {inf.channel && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setTrackingInfluencer(inf)}
                            className="text-link text-sm"
                          >
                            Track
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setOutreachTarget({
                                channel: inf.channel!,
                                influencerId: inf.id,
                              })
                            }
                            className="text-link text-sm"
                          >
                            Outreach
                          </button>
                          <Link href={`/channels/${inf.channel_id}`} className="text-link text-sm">
                            Profile
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Select a creator list below to view outreach details
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <h2 className="section-title">Your lists</h2>
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary min-h-[36px] text-sm">
            + New list
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="border-b border-white/10 bg-white/5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                className="input-field"
                placeholder="List name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="text"
                className="input-field"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? "Creating…" : "Create list"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            {requiresAuth ? (
              <p>Sign in to create your first creator list.</p>
            ) : (
              <p>No creator lists yet. Create your first list above.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-6 py-3">List name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Export</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className={`table-row cursor-pointer ${selected?.id === c.id ? "table-row-selected" : ""}`}
                    onClick={() => loadCampaignDetail(c.id)}
                  >
                    <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                    <td className="px-4 py-4 capitalize text-slate-400">{c.status}</td>
                    <td className="px-4 py-4 text-slate-400">{c.description ?? "—"}</td>
                    <td className="px-4 py-4 text-slate-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={`/api/campaigns/${c.id}/export`}
                        className="text-link text-sm"
                        onClick={(e) => e.stopPropagation()}
                        download
                      >
                        Export CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {outreachTarget && (
        <EmailOutreachModal
          channel={outreachTarget.channel}
          campaignInfluencerId={outreachTarget.influencerId}
          campaignName={selected?.name}
          open={!!outreachTarget}
          onClose={() => setOutreachTarget(null)}
          onContactedMarked={() => {
            if (selected) loadCampaignDetail(selected.id);
          }}
        />
      )}

      {trackingInfluencer && (
        <CampaignTrackingModal
          influencer={trackingInfluencer}
          creatorName={trackingInfluencer.channel?.title ?? trackingInfluencer.channel_id}
          open={!!trackingInfluencer}
          onClose={() => setTrackingInfluencer(null)}
          onSaved={handleInfluencerUpdated}
        />
      )}
    </div>
  );
}
