"use client";

import { CreatorTable } from "@/components/ui";
import type { Channel } from "@/lib/types";

export function RecommendedCreatorsGrid({ channels }: { channels: Channel[] }) {
  return <CreatorTable channels={channels} />;
}

export function RecentCreatorsGrid({ channels }: { channels: Channel[] }) {
  return <CreatorTable channels={channels} />;
}
