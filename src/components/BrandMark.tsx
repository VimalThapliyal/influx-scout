import { BRAND_LOGO_LETTERS, BRAND_NAME } from "@/lib/brand";

type BrandMarkSize = "sm" | "md" | "lg";

const sizeClasses: Record<
  BrandMarkSize,
  { box: string; text: string; label: string }
> = {
  sm: {
    box: "h-8 w-8 rounded-lg text-[10px]",
    text: "text-xs font-bold",
    label: "text-sm font-semibold",
  },
  md: {
    box: "h-9 w-9 rounded-xl text-xs",
    text: "text-xs font-bold",
    label: "text-sm font-semibold",
  },
  lg: {
    box: "h-10 w-10 rounded-xl text-sm",
    text: "text-sm font-bold",
    label: "text-lg font-semibold tracking-tight",
  },
};

export function BrandMark({
  size = "md",
  showName = true,
  tagline,
  className = "",
  variant = "app",
}: {
  size?: BrandMarkSize;
  showName?: boolean;
  tagline?: string;
  className?: string;
  /** "mkt" = marketing site (amber stamp, poster type). Default "app" is unchanged. */
  variant?: "app" | "mkt";
}) {
  const s = sizeClasses[size];

  if (variant === "mkt") {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-sm border-2 border-mkt-tally font-mono font-bold text-mkt-tally ${s.box}`}
          aria-hidden
        >
          {BRAND_LOGO_LETTERS}
        </div>
        {showName && (
          <div>
            <p className={`font-poster uppercase tracking-wide text-mkt-paper ${s.label}`}>
              {BRAND_NAME}
            </p>
            {tagline && <p className="font-mono text-[10px] text-mkt-ash">{tagline}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600 font-bold text-white shadow-lg shadow-violet-500/30 ${s.box}`}
        aria-hidden
      >
        {BRAND_LOGO_LETTERS}
      </div>
      {showName && (
        <div>
          <p className={`font-display text-white ${s.label}`}>{BRAND_NAME}</p>
          {tagline && (
            <p className="text-[10px] text-slate-500">{tagline}</p>
          )}
        </div>
      )}
    </div>
  );
}
