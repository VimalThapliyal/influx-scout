"use client";

const PLATFORMS = [
  { id: "youtube", label: "YouTube", active: true },
  { id: "instagram", label: "Instagram", active: false },
  { id: "tiktok", label: "TikTok", active: false },
  { id: "linkedin", label: "LinkedIn", active: false },
] as const;

export function PlatformSwitcher({ variant = "sidebar" }: { variant?: "sidebar" | "discover" }) {
  if (variant === "discover") {
    return (
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) =>
          p.active ? (
            <span
              key={p.id}
              className="inline-flex items-center gap-2 rounded-sm border border-mkt-tally/40 bg-mkt-tally/15 px-4 py-2 text-sm font-medium text-mkt-tally"
            >
              <span className="h-2 w-2 rounded-full bg-mkt-tally" />
              {p.label}
            </span>
          ) : (
            <span
              key={p.id}
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-500"
              title="Coming soon"
            >
              {p.label}
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Soon
              </span>
            </span>
          )
        )}
      </div>
    );
  }

  return (
    <div className="px-3 pb-2">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
        Platforms
      </p>
      <div className="space-y-1">
        {PLATFORMS.map((p) =>
          p.active ? (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-sm bg-mkt-tally/10 px-3 py-2 text-sm font-medium text-mkt-tally"
            >
              <span>{p.label}</span>
              <span className="text-[10px] text-mkt-tally">Live</span>
            </div>
          ) : (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-500"
              title="Coming soon"
            >
              <span>{p.label}</span>
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                Soon
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
