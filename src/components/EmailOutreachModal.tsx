"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-fg/40 p-4 sm:items-center">
      <div
        className="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="outreach-title"
      >
        <div className="border-b border-line px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="outreach-title" className="h-section">
                {step === "campaign" ? `Add ${channel.title} to a list` : `Write to ${channel.title}`}
              </h2>
              {step === "compose" && campaignName && (
                <p className="mt-1 text-sm text-muted">
                  Tracking in: <span className="text-accent">{campaignName}</span>
                </p>
              )}
              {step === "campaign" && (
                <p className="mt-1 text-sm text-muted">
                  Add to a campaign list first so outreach status is tracked automatically.
                </p>
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

        {step === "campaign" ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {membershipsLoading ? (
              <p className="text-sm text-muted">Loading lists</p>
            ) : (
              <>
                {memberships.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted">Already in these lists</p>
                    <ul className="space-y-2">
                      {memberships.map((m) => (
                        <li key={m.influencer_id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMembership(m);
                              setStep("compose");
                            }}
                            className="w-full rounded-lg border border-line bg-subtle px-4 py-3 text-left text-sm transition hover:border-accent/40 hover:bg-accent-soft"
                          >
                            <span className="font-medium text-fg">{m.campaign_name}</span>
                            <span className="mt-0.5 block text-xs capitalize text-muted">
                              Status: {m.status.replace("_", " ")}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted">Or add to another list:</p>
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
                <div className="rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
                  No campaign list selected — outreach won&apos;t be tracked.{" "}
                  <button
                    type="button"
                    className="font-medium underline hover:text-fg"
                    onClick={() => setStep("campaign")}
                  >
                    Add to a list
                  </button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Your brand</label>
                  <input
                    className="input-field"
                    placeholder="Acme Co."
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Your name</label>
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
                  <label className="mb-1 block text-xs font-medium text-muted">Goal</label>
                  <select
                    className="input-field"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value as OutreachGoal)}
                  >
                    {GOALS.map((g) => (
                      <option key={g.value} value={g.value} className="bg-surface">
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Tone</label>
                  <select
                    className="input-field"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as OutreachTone)}
                  >
                    {TONES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-surface">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Extra notes <span className="text-muted">(optional)</span>
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
                {loading ? "Generating" : "Generate personalized email"}
              </button>

              {source && (
                <p className="text-center text-xs text-muted">
                  Generated via {source === "ai" ? "AI" : "smart template"}
                </p>
              )}

              {error && (
                <p
                  className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {(subject || body) && (
                <div className="space-y-3 rounded-lg border border-line bg-subtle p-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Subject</label>
                    <input
                      className="input-field"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Message</label>
                    <textarea
                      className="input-field min-h-[200px] resize-y text-sm leading-relaxed"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={10}
                    />
                  </div>
                </div>
              )}

              {!hasEmail && (
                <p className="text-xs text-muted">
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
                <p className="rounded-lg border border-success/30 bg-success-soft px-4 py-2 text-sm text-success">
                  Marked as contacted in {campaignName}
                </p>
              )}
            </div>

            {(subject || body) && (
              <div className="space-y-3 border-t border-line px-6 py-4">
                {showMarkPrompt && campaignInfluencerId && !markedContacted && (
                  <div className="rounded-lg border border-accent/30 bg-accent-soft p-4">
                    <p className="text-sm font-medium text-fg">Mark as contacted?</p>
                    <p className="mt-1 text-xs text-muted">
                      Update {campaignName} pipeline — sets status to contacted and records send time.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={markContacted}
                        disabled={markingContacted}
                        className="btn-primary flex-1 text-sm"
                      >
                        {markingContacted ? "Saving" : "Yes, mark contacted"}
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
                    className="btn-secondary flex-1 text-sm"
                    onClick={() => copyText("all", `Subject: ${subject}\n\n${body}`)}
                  >
                    {copied === "all" ? "Copied!" : "Copy all"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() => copyText("body", body)}
                  >
                    {copied === "body" ? "Copied!" : "Copy body"}
                  </button>
                  {mailto ? (
                    <a
                      href={mailto}
                      onClick={handleMailtoClick}
                      className="btn-primary flex-1 text-center text-sm"
                    >
                      Open in mail app
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary flex-1 opacity-50"
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
