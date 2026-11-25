import Link from "next/link";
import { Avatar } from "@/components/ui";
import { formatCount, type SeoCreator } from "@/lib/seo";

function daysAgo(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

/** Ranked creator table for public list pages. Never shows contact details, only whether one exists. */
export function CreatorRankList({ creators, unlockHref }: { creators: SeoCreator[]; unlockHref: string }) {
  const th = "h-9 px-3 font-medium";
  return (
    <div className="card overflow-hidden">
      <table className="w-full table-fixed text-[0.8125rem]">
        <thead className="table-head">
          <tr>
            <th scope="col" className={`${th} w-9 text-right`}>#</th>
            <th scope="col" className={th}>Creator</th>
            <th scope="col" className={`${th} w-[4.5rem] text-right sm:w-24`}>Subs<span className="hidden sm:inline">cribers</span></th>
            <th scope="col" className={`${th} hidden w-24 text-right sm:table-cell`}>Avg views</th>
            <th scope="col" className={`${th} hidden w-28 md:table-cell`}>Last upload</th>
            <th scope="col" className={`${th} w-[5.75rem] text-right sm:w-28`}>Contact</th>
          </tr>
        </thead>
        <tbody>
          {creators.map((c, i) => (
            <tr key={c.id} className="table-row h-12">
              <td className="px-3 text-right tabular-nums text-muted">{i + 1}</td>
              <td className="px-3">
                <a
                  href={`https://www.youtube.com/channel/${c.id}`}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="group flex min-w-0 items-center gap-2.5"
                >
                  <Avatar src={c.thumbnail_url} name={c.title} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-fg group-hover:text-accent">{c.title}</span>
                    {c.handle && <span className="block truncate text-xs text-muted">{c.handle}</span>}
                  </span>
                </a>
              </td>
              <td className="px-3 text-right tabular-nums">{formatCount(c.subscriber_count)}</td>
              <td className="hidden px-3 text-right tabular-nums sm:table-cell">{formatCount(c.avg_views_last5)}</td>
              <td className="hidden px-3 text-muted md:table-cell">{daysAgo(c.latest_upload_at)}</td>
              <td className="px-3 text-right">
                {c.has_contact ? (
                  <Link href={unlockHref} className="text-link whitespace-nowrap">
                    See contact
                  </Link>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
