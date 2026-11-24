import { mapYouTubeChannelToDb } from "../../src/lib/youtube";
import { getChannelDetails, searchChannels } from "./youtube-api";
import { type ChannelRow, upsertDiscoveredChannels } from "./supabase";
import {
  TARGET_MARKET_LABEL,
  isTargetMarketCountry,
  pickRotatingRegionCode,
  type SearchRegionCode,
} from "./markets";

export interface DiscoverOptions {
  limit: number;
  regionCode?: SearchRegionCode | string;
  targetMarketsOnly?: boolean;
  regionSeed?: number;
}

export async function discoverNiche(
  niche: string,
  limit: number,
  options: DiscoverOptions = { limit, targetMarketsOnly: true }
): Promise<ChannelRow[]> {
  const regionCode =
    options.regionCode ?? pickRotatingRegionCode(options.regionSeed ?? Date.now());
  const targetMarketsOnly = options.targetMarketsOnly !== false;

  console.log(
    `Discovering channels for niche: "${niche}" (limit ${limit}, region ${regionCode}, market ${targetMarketsOnly ? TARGET_MARKET_LABEL : "worldwide"})…`
  );

  const search = await searchChannels(niche, limit, { regionCode });
  const ids = (search.items ?? []).map((item) => item.id.channelId).filter(Boolean);

  if (ids.length === 0) {
    console.log("No channels found for this niche.");
    return [];
  }

  console.log(
    `  YouTube returned ${ids.length} channel(s). Fetching details (API cost: ~${100 + ids.length} units)…`
  );

  const details = await getChannelDetails(ids);
  let mapped = details.map((item) => mapYouTubeChannelToDb(item));

  if (targetMarketsOnly) {
    const before = mapped.length;
    mapped = mapped.filter((ch) => isTargetMarketCountry(ch.country));
    const skipped = before - mapped.length;
    if (skipped > 0) {
      console.log(
        `  Filtered to ${TARGET_MARKET_LABEL}: kept ${mapped.length}, skipped ${skipped} outside market.`
      );
    }
  }

  if (mapped.length === 0) {
    console.log(`  No channels matched ${TARGET_MARKET_LABEL} for this search.`);
    return [];
  }

  const rows = await upsertDiscoveredChannels(mapped);
  console.log(`  Saved ${rows.length} channel(s) to Supabase.\n`);
  return rows;
}
