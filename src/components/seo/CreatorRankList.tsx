import Link from "next/link";
import { formatCount, type SeoCreator } from "@/lib/seo";

function daysAgo(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/** Server-rendered ranked creator table for public SEO pages. Never shows emails. */
export function CreatorRankList({
  creators,
  unlockHref,
}: {
  creators: SeoCreator[];
  unlockHref: string;
}) {
  return (
    <ol className="mkt-card divide-y divide-mkt-manila/15 overflow-hidden">
      {creators.map((c, i) => (
        <li key={c.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
          <span className="w-7 shrink-0 text-right font-mono text-sm text-mkt-ash">{i + 1}</span>
          {c.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.thumbnail_url}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              className="h-11 w-11 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="h-11 w-11 shrink-0 rounded-full bg-white/5" />
          )}
          <div className="min-w-0 flex-1">
            <a
              href={`https://www.youtube.com/channel/${c.id}`}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="block truncate font-medium text-mkt-paper hover:underline"
            >
              {c.title}
            </a>
            <p className="truncate font-mono text-xs text-mkt-ash">
              {c.handle ? `${c.handle} · ` : ""}last upload {daysAgo(c.latest_upload_at)}
            </p>
          </div>
          <dl className="hidden shrink-0 grid-cols-2 gap-x-6 text-right sm:grid">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-mkt-ash">Subscribers</dt>
              <dd className="font-mono text-sm text-mkt-paper">{formatCount(c.subscriber_count)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-mkt-ash">Avg views</dt>
              <dd className="font-mono text-sm text-mkt-paper">{formatCount(c.avg_views_last5)}</dd>
            </div>
          </dl>
          <div className="w-24 shrink-0 text-right">
            {c.has_contact ? (
              <Link href={unlockHref} className="font-mono text-[11px] uppercase tracking-wider text-mkt-tally hover:brightness-110">
                Contact →
              </Link>
            ) : (
              <span className="font-mono text-[11px] uppercase tracking-wider text-mkt-ash/60">—</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
