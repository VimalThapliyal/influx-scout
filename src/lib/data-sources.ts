/** User-facing labels for the creator data source. */
export const DATA_SOURCE = {
  database: {
    id: "database" as const,
    label: "Your database",
    shortLabel: "Database",
    description:
      "Pre-scraped YouTube creators (USA & Europe focus) — emails, scores, and outreach filters in your library.",
    path: "/channels",
  },
};

export type DataSourceId = (typeof DATA_SOURCE)[keyof typeof DATA_SOURCE]["id"];
