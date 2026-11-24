"use client";

import { CreatorGridCard } from "@/components/ui";
import type { Channel } from "@/lib/types";

export function RecommendedCreatorsGrid({ channels }: { channels: Channel[] }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {channels.map((ch) => (
        <CreatorGridCard
          key={ch.id}
          channel={ch}
          showEmailBadge
        />
      ))}
    </div>
  );
}

export function RecentCreatorsGrid({ channels }: { channels: Channel[] }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {channels.map((ch) => (
        <CreatorGridCard
          key={ch.id}
          channel={ch}
          showEmailBadge
        />
      ))}
    </div>
  );
}
