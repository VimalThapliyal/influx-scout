"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Channel } from "@/lib/types";
import type { OutreachGoal, OutreachTone } from "@/lib/outreach";
import { buildMailtoLink } from "@/lib/outreach";
import { BRAND_STORAGE_PREFIX } from "@/lib/brand";
import { PAYMENTS_ENABLED } from "@/lib/billing";
import {
  CampaignPicker,
  type CampaignMembership,
} from "@/components/CampaignPicker";

const STORAGE_KEY = `${BRAND_STORAGE_PREFIX}-outreach`;
const LEGACY_STORAGE_KEY = "influencer-intel-outreach";

const GOALS: { value: OutreachGoal; label: string }[] = [
  { value: "brand_partnership", label: "Brand partnership" },
  { value: "sponsorship", label: "Sponsored video" },
  { value: "product_review", label: "Product review" },
  { value: "affiliate", label: "Affiliate" },
];

const TONES: { value: OutreachTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
];

export function EmailOutreachModal({
  channel,
  campaignName: initialCampaignName,
  campaignInfluencerId: initialInfluencerId,
  open,
  onClose,
  onContactedMarked,
}: {
  channel: Channel;
  campaignName?: string;
  campaignInfluencerId?: string;
  open: boolean;
  onClose: () => void;
  onContactedMarked?: () => void;
}) {
  const [step, setStep] = useState<"campaign" | "compose">("compose");
  const [memberships, setMemberships] = useState<CampaignMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<CampaignMembership | null>(
    null
  );

  const [brandName, setBrandName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [goal, setGoal] = useState<OutreachGoal>("brand_partnership");
  const [tone, setTone] = useState<OutreachTone>("professional");
  const [customNotes, setCustomNotes] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [source, setSource] = useState<"ai" | "template" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showMarkPrompt, setShowMarkPrompt] = useState(false);
  const [markingContacted, setMarkingContacted] = useState(false);
  const [markedContacted, setMarkedContacted] = useState(false);

  const campaignInfluencerId = selectedMembership?.influencer_id ?? initialInfluencerId;
  const campaignName = selectedMembership?.campaign_name ?? initialCampaignName;

  useEffect(() => {
    if (!open) return;

    setSubject("");
    setBody("");
    setSource(null);
    setError(null);
    setShowMarkPrompt(false);
    setMarkedContacted(false);

    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ??
          localStorage.getItem(LEGACY_STORAGE_KEY) ??
          "{}"
      );
      if (saved.brandName) setBrandName(saved.brandName);
      if (saved.senderName) setSenderName(saved.senderName);
    } catch {
      // ignore
    }

    if (initialInfluencerId && initialCampaignName) {
      setSelectedMembership({
        influencer_id: initialInfluencerId,
        campaign_id: "",
        campaign_name: initialCampaignName,
        status: "identified",
        email_sent_at: null,
      });
      setStep("compose");
      return;
    }

    setMembershipsLoading(true);
    fetch(`/api/channels/${channel.id}/campaigns`)
      .then((r) => r.json())
      .then((d) => {
        const list: CampaignMembership[] = d.memberships ?? [];
        setMemberships(list);
        if (list.length === 1) {
          setSelectedMembership(list[0]);
          setStep("compose");
        } else if (list.length > 1) {
          setSelectedMembership(null);
          setStep("campaign");
        } else {
          setSelectedMembership(null);
          setStep("campaign");
        }
      })
      .finally(() => setMembershipsLoading(false));
  }, [open, channel.id, initialInfluencerId, initialCampaignName]);

  function persistFields() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ brandName, senderName }));
  }

  async function generate() {
    if (!brandName.trim() || !senderName.trim()) {
      setError("Enter your brand name and your name");
      return;
    }

    persistFields();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: {
            title: channel.title,
            description: channel.description,
            handle: channel.handle,
            subscriber_count: channel.subscriber_count,
            tier: channel.tier,
            avg_views_per_video: channel.avg_views_per_video,
            influencer_score: channel.influencer_score,
          },
          brandName,
          senderName,
          goal,
          tone,
          campaignName,
          customNotes: customNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      setSubject(data.subject);
      setBody(data.body);
      setSource(data.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  async function markContacted() {
    if (!campaignInfluencerId) return;

    setMarkingContacted(true);
    try {
      const res = await fetch(`/api/campaigns/influencers/${campaignInfluencerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_contacted: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");

      setMarkedContacted(true);
      setShowMarkPrompt(false);
      onContactedMarked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark contacted");
    } finally {
      setMarkingContacted(false);
    }
  }

  function handleMailtoClick() {
    if (campaignInfluencerId && !markedContacted) {
      setShowMarkPrompt(true);
    }
  }

  const hasEmail = !!(channel.email && !channel.email_locked);
  const mailto =
    hasEmail && subject && body
      ? buildMailtoLink(channel.email!, subject, body)
      : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        className="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl shadow-mkt-tally/10"
        role="dialog"
        aria-labelledby="outreach-title"
      >
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-mkt-tally">
                Email outreach
              </p>
              <h2 id="outreach-title" className="mt-1 font-display text-lg font-semibold text-white">
                {step === "campaign" ? `Add ${channel.title} to a list` : `Write to ${channel.title}`}
              </h2>
              {step === "compose" && campaignName && (
                <p className="mt-1 text-sm text-slate-500">
                  Tracking in: <span className="text-mkt-tally">{campaignName}</span>
                </p>
              )}
              {step === "campaign" && (
                <p className="mt-1 text-sm text-slate-500">
                  Add to a campaign list first so outreach status is tracked automatically.
                </p>
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

        {step === "campaign" ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {membershipsLoading ? (
              <p className="text-sm text-slate-500">Loading lists…</p>
            ) : (
              <>
                {memberships.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400">Already in these lists</p>
                    <ul className="space-y-2">
                      {memberships.map((m) => (
                        <li key={m.influencer_id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMembership(m);
                              setStep("compose");
                            }}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm transition hover:border-mkt-tally/40 hover:bg-mkt-tally/10"
                          >
                            <span className="font-medium text-white">{m.campaign_name}</span>
                            <span className="mt-0.5 block text-xs capitalize text-slate-500">
                              Status: {m.status.replace("_", " ")}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-slate-600">Or add to another list:</p>
                  </div>
                )}

                <CampaignPicker
                  channelId={channel.id}
                  submitLabel="Select a list above or create new"
                  onAdded={(membership) => {
                    setSelectedMembership(membership);
                    setMemberships((prev) => {
                      if (prev.some((m) => m.influencer_id === membership.influencer_id)) {
                        return prev;
                      }
                      return [...prev, membership];
                    });
                    setStep("compose");
                  }}
                />
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {!campaignInfluencerId && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  No campaign list selected — outreach won&apos;t be tracked.{" "}
                  <button
                    type="button"
                    className="font-medium underline hover:text-amber-100"
                    onClick={() => setStep("campaign")}
                  >
                    Add to a list
                  </button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Your brand</label>
                  <input
                    className="input-field"
                    placeholder="Acme Co."
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Your name</label>
                  <input
                    className="input-field"
                    placeholder="Jane Smith"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Goal</label>
                  <select
                    className="input-field"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value as OutreachGoal)}
                  >
                    {GOALS.map((g) => (
                      <option key={g.value} value={g.value} className="bg-[#0f172a]">
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Tone</label>
                  <select
                    className="input-field"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as OutreachTone)}
                  >
                    {TONES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-[#0f172a]">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Extra notes <span className="text-slate-600">(optional)</span>
                </label>
                <textarea
                  className="input-field min-h-[72px] resize-y"
                  placeholder="Mention a specific video you liked, budget range, timeline…"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? "Generating…" : "✦ Generate personalized email"}
              </button>

              {source && (
                <p className="text-center text-xs text-slate-500">
                  Generated via {source === "ai" ? "AI" : "smart template"}
                </p>
              )}

              {error && (
                <p
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {(subject || body) && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">Subject</label>
                    <input
                      className="input-field"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">Message</label>
                    <textarea
                      className="input-field min-h-[200px] resize-y font-mono text-sm leading-relaxed"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={10}
                    />
                  </div>
                </div>
              )}

              {!hasEmail && (
                <p className="text-xs text-slate-500">
                  Email address locked.{" "}
                  {PAYMENTS_ENABLED ? (
                    <>
                      <Link href="/subscribe" className="text-link">
                        Upgrade to Pro
                      </Link>{" "}
                      to open in your mail app, or copy the draft and reach out via social.
                    </>
                  ) : (
                    <>Pro is coming soon. For now, copy the draft and reach out via social.</>
                  )}
                </p>
              )}

              {markedContacted && (
                <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                  Marked as contacted in {campaignName}
                </p>
              )}
            </div>

            {(subject || body) && (
              <div className="space-y-3 border-t border-white/10 px-6 py-4">
                {showMarkPrompt && campaignInfluencerId && !markedContacted && (
                  <div className="rounded-xl border border-mkt-tally/30 bg-mkt-tally/10 p-4">
                    <p className="text-sm font-medium text-white">Mark as contacted?</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Update {campaignName} pipeline — sets status to contacted and records send time.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={markContacted}
                        disabled={markingContacted}
                        className="btn-primary flex-1 text-sm"
                      >
                        {markingContacted ? "Saving…" : "Yes, mark contacted"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMarkPrompt(false)}
                        className="btn-secondary text-sm"
                      >
                        Not now
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary min-h-[40px] flex-1 text-sm"
                    onClick={() => copyText("all", `Subject: ${subject}\n\n${body}`)}
                  >
                    {copied === "all" ? "Copied!" : "Copy all"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary min-h-[40px] text-sm"
                    onClick={() => copyText("body", body)}
                  >
                    {copied === "body" ? "Copied!" : "Copy body"}
                  </button>
                  {mailto ? (
                    <a
                      href={mailto}
                      onClick={handleMailtoClick}
                      className="btn-primary min-h-[40px] flex-1 text-center text-sm"
                    >
                      Open in mail app
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary min-h-[40px] flex-1 opacity-50"
                      disabled
                    >
                      Open in mail app
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
