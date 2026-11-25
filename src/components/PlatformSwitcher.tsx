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
              className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-medium text-accent"
            >
              <span className="h-2 w-2 rounded-full bg-accent" />
              {p.label}
            </span>
          ) : (
            <span
              key={p.id}
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-line bg-subtle px-4 py-2 text-sm text-muted"
              title="Coming soon"
            >
              {p.label}
              <span className="rounded-md bg-subtle px-1.5 py-0.5 text-xs font-semibold text-muted">
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
      <p className="mb-2 px-3 text-xs font-semibold text-muted">
        Platforms
      </p>
      <div className="space-y-1">
        {PLATFORMS.map((p) =>
          p.active ? (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent"
            >
              <span>{p.label}</span>
              <span className="text-xs text-accent">Live</span>
            </div>
          ) : (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted"
              title="Coming soon"
            >
              <span>{p.label}</span>
              <span className="rounded-md bg-subtle px-1.5 py-0.5 text-xs font-medium text-muted">
                Soon
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
