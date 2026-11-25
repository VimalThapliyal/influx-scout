import type { ReactNode } from "react";

/** Typography for blog articles on the dark marketing theme. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        "text-body max-w-2xl space-y-5",
        "[&_h2]:!mt-12 [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-fg",
        "[&_h3]:!mt-8 [&_h3]:font-semibold [&_h3]:text-fg",
        "[&_strong]:text-fg",
        "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
        "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Simple data table: first row is the header. */
export function DataTable({ head, rows, caption }: { head: string[]; rows: (string | number)[][]; caption?: string }) {
  return (
    <figure className="!my-8">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {head.map((h) => (
                <th
                  key={h}
                  className="border-b border-line px-4 py-2.5 text-left text-xs text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {r.map((c, j) => (
                  <td key={j} className={`px-4 py-2.5 ${j === 0 ? "text-fg" : " tabular-nums"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <figcaption className="mt-2 text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}
