"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Campaign, CampaignInfluencer, Channel } from "@/lib/types";
import { Download, Mail, Plus } from "lucide-react";
import { Avatar, EmptyState, StatusTag, TableSkeleton } from "@/components/ui";
import { EmailGate } from "@/components/EmailGate";
import { EmailOutreachModal } from "@/components/EmailOutreachModal";
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

  const members = selected?.influencers ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-page">Campaigns</h1>
          <p className="page-subtitle">Group creators into lists and track who you contacted and who replied.</p>
        </div>
        {!requiresAuth && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={15} strokeWidth={1.75} aria-hidden />
            New list
          </button>
        )}
      </div>

      {requiresAuth ? (
        <EmptyState
          title="Sign in to use campaign lists"
          description="Lists and outreach tracking are saved to your account. You can keep browsing creators without one."
          action={
            <Link href={`/login?redirect=${encodeURIComponent("/campaigns")}`} className="btn-primary btn-sm">
              Sign in
            </Link>
          }
        />
      ) : (
        <>
          {showCreate && (
            <form onSubmit={handleCreate} className="card p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="list-name" className="field-label">List name</label>
                  <input
                    id="list-name"
                    type="text"
                    className="input-field"
                    placeholder="Spring launch, fitness creators"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="list-description" className="field-label">
                    Description <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    id="list-description"
                    type="text"
                    className="input-field"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              {error && (
                <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger" role="alert">
                  {error}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? "Creating list" : "Create list"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <TableSkeleton rows={3} />
          ) : campaigns.length === 0 ? (
            <EmptyState
              title="No lists yet"
              description="Create a list, then add creators to it with the bookmark button in the creator library."
              action={
                !showCreate ? (
                  <button type="button" onClick={() => setShowCreate(true)} className="btn-secondary btn-sm">
                    New list
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-[0.8125rem]">
                <thead className="table-head">
                  <tr>
                    <th scope="col" className="h-9 px-4 font-medium">List</th>
                    <th scope="col" className="h-9 px-3 font-medium">Status</th>
                    <th scope="col" className="hidden h-9 px-3 font-medium md:table-cell">Description</th>
                    <th scope="col" className="hidden h-9 px-3 font-medium sm:table-cell">Created</th>
                    <th scope="col" className="h-9 w-28 px-3 font-medium"><span className="sr-only">Export</span></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr
                      key={c.id}
                      className={`table-row h-11 cursor-pointer ${selected?.id === c.id ? "table-row-selected" : ""}`}
                      onClick={() => loadCampaignDetail(c.id)}
                    >
                      <td className="px-4">
                        <button
                          type="button"
                          aria-pressed={selected?.id === c.id}
                          className="font-medium text-fg hover:text-accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadCampaignDetail(c.id);
                          }}
                        >
                          {c.name}
                        </button>
                      </td>
                      <td className="px-3"><StatusBadge status={c.status} /></td>
                      <td className="hidden max-w-xs truncate px-3 text-muted md:table-cell">{c.description || "—"}</td>
                      <td className="hidden px-3 tabular-nums text-muted sm:table-cell">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 text-right">
                        <a
                          href={`/api/campaigns/${c.id}/export`}
                          className="btn-ghost btn-sm"
                          onClick={(e) => e.stopPropagation()}
                          download
                        >
                          <Download size={14} strokeWidth={1.75} aria-hidden />
                          CSV
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {campaigns.length > 0 && (
            <section aria-labelledby="members-title">
              <h2 id="members-title" className="h-section mb-3">
                {selected ? selected.name : "Creators in a list"}
              </h2>
              {!selected ? (
                <p className="card px-4 py-5 text-sm text-muted">Select a list above to see its creators and their status.</p>
              ) : members.length === 0 ? (
                <EmptyState
                  title="This list is empty"
                  description="Add creators with the bookmark button in the creator library."
                  action={
                    <Link href="/channels" className="btn-secondary btn-sm">
                      Find creators
                    </Link>
                  }
                />
              ) : (
                <div className="card overflow-hidden">
                  <PipelineSummary influencers={members} />
                  <div className="overflow-x-auto">
                    <table className="w-full text-[0.8125rem]">
                      <thead className="table-head">
                        <tr>
                          <th scope="col" className="h-9 px-4 font-medium">Creator</th>
                          <th scope="col" className="h-9 px-3 font-medium">Status</th>
                          <th scope="col" className="h-9 px-3 font-medium">Last contact</th>
                          <th scope="col" className="h-9 px-3 font-medium">Replied</th>
                          <th scope="col" className="h-9 px-3 font-medium">Email</th>
                          <th scope="col" className="h-9 px-3 font-medium"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((inf) => (
                          <tr key={inf.id} className="table-row h-12">
                            <td className="px-4">
                              <Link href={`/channels/${inf.channel_id}`} className="group flex min-w-0 items-center gap-2.5">
                                <Avatar src={inf.channel?.thumbnail_url} name={inf.channel?.title ?? "?"} size={28} />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-fg group-hover:text-accent">
                                    {inf.channel?.title ?? inf.channel_id}
                                  </span>
                                  {inf.notes && <span className="block max-w-xs truncate text-xs text-muted">{inf.notes}</span>}
                                </span>
                              </Link>
                            </td>
                            <td className="px-3"><StatusBadge status={inf.status} /></td>
                            <td className="px-3 tabular-nums text-muted">
                              {inf.email_sent_at ? new Date(inf.email_sent_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-3">
                              {inf.replied ? <StatusTag tone="success">Replied</StatusTag> : <span className="text-faint">—</span>}
                            </td>
                            <td className="px-3">
                              {inf.channel?.has_email || inf.channel?.email || inf.channel?.email_masked ? (
                                <EmailGate
                                  email={inf.channel?.email}
                                  maskedPreview={inf.channel?.email_masked}
                                  locked={inf.channel?.email_locked}
                                  showCopy
                                />
                              ) : (
                                <span className="text-faint">—</span>
                              )}
                            </td>
                            <td className="px-3">
                              {inf.channel && (
                                <div className="flex justify-end gap-1">
                                  <button type="button" onClick={() => setTrackingInfluencer(inf)} className="btn-ghost btn-sm">
                                    Update status
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOutreachTarget({ channel: inf.channel!, influencerId: inf.id })}
                                    className="btn-secondary btn-sm"
                                  >
                                    <Mail size={14} strokeWidth={1.75} aria-hidden />
                                    Draft email
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

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
