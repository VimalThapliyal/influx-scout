import { BRAND_LOGO_LETTERS, BRAND_NAME } from "@/lib/brand";

type BrandMarkSize = "sm" | "md" | "lg";

const sizeClasses: Record<
  BrandMarkSize,
  { box: string; text: string; label: string }
> = {
  sm: {
    box: "h-8 w-8 rounded-lg text-xs",
    text: "text-xs font-bold",
    label: "text-sm font-semibold",
  },
  md: {
    box: "h-9 w-9 rounded-lg text-xs",
    text: "text-xs font-bold",
    label: "text-sm font-semibold",
  },
  lg: {
    box: "h-10 w-10 rounded-lg text-sm",
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
          className={`flex shrink-0 items-center justify-center rounded-md border-2 border-accent font-bold text-accent ${s.box}`}
          aria-hidden
        >
          {BRAND_LOGO_LETTERS}
        </div>
        {showName && (
          <div>
            <p className={`text-fg ${s.label}`}>
              {BRAND_NAME}
            </p>
            {tagline && <p className="text-xs text-muted">{tagline}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600 font-bold text-fg shadow-pop shadow-violet-500/30 ${s.box}`}
        aria-hidden
      >
        {BRAND_LOGO_LETTERS}
      </div>
      {showName && (
        <div>
          <p className={`text-fg ${s.label}`}>{BRAND_NAME}</p>
          {tagline && (
            <p className="text-xs text-muted">{tagline}</p>
          )}
        </div>
      )}
    </div>
  );
}
