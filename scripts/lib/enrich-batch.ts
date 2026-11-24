import type { Page } from "playwright";
import { fetchChannelsToEnrich, type ChannelRow, upsertEnrichment } from "./supabase";
import { scrapeChannelAbout, sleep } from "./youtube-scraper";

export interface EnrichBatchStats {
  processed: number;
  enriched: number;
  skipped: number;
  failed: number;
  locked: number;
  stoppedEarly: boolean;
  stopReason?: string;
}

export interface EnrichBatchOptions {
  limit: number;
  enrichOnly: boolean;
  channelIds?: string[];
  delayMs: number;
  jitterMs: number;
  pauseOnCaptcha: boolean;
  maxLockedStreak: number;
  remainingBudget?: number;
}

function delayWithJitter(baseMs: number, jitterMs: number): number {
  if (jitterMs <= 0) return baseMs;
  return baseMs + Math.floor(Math.random() * jitterMs);
}

export async function enrichChannels(
  page: Page,
  options: EnrichBatchOptions
): Promise<{ channels: ChannelRow[]; stats: EnrichBatchStats }> {
  const budget = options.remainingBudget ?? options.limit;
  const fetchLimit = Math.min(options.limit, Math.max(0, budget));

  const channels = await fetchChannelsToEnrich({
    limit: fetchLimit,
    enrichOnly: options.enrichOnly,
    channelIds: options.channelIds,
  });

  const stats: EnrichBatchStats = {
    processed: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    locked: 0,
    stoppedEarly: false,
  };

  if (channels.length === 0) return { channels: [], stats };

  let lockedStreak = 0;

  for (let i = 0; i < channels.length; i++) {
    if (budget > 0 && stats.processed >= budget) {
      stats.stoppedEarly = true;
      stats.stopReason = "nightly enrichment budget reached";
      break;
    }

    const channel = channels[i];
    const label = channel.handle ?? channel.id;
    process.stdout.write(
      `  [${i + 1}/${channels.length}] ${channel.title} (${label}) … `
    );

    try {
      const result = await scrapeChannelAbout(page, channel, {
        pauseOnCaptcha: options.pauseOnCaptcha,
      });
      const { updated } = await upsertEnrichment(channel.id, channel, result);

      stats.processed++;

      if (result.email_status === "locked") {
        stats.locked++;
        lockedStreak++;
      } else {
        lockedStreak = 0;
      }

      if (updated) {
        stats.enriched++;
        const status =
          result.email_status === "found"
            ? result.email ?? "found"
            : result.email_status;
        console.log(`✓ ${status}`);
      } else {
        stats.skipped++;
        console.log(`– ${result.email_status}`);
      }

      if (lockedStreak >= options.maxLockedStreak) {
        stats.stoppedEarly = true;
        stats.stopReason = `${options.maxLockedStreak} consecutive CAPTCHA locks — stopping to avoid a ban`;
        break;
      }
    } catch (err) {
      stats.processed++;
      stats.failed++;
      lockedStreak = 0;
      const msg = err instanceof Error ? err.message : "unknown error";
      console.log(`✗ ${msg}`);
    }

    if (i < channels.length - 1) {
      await sleep(delayWithJitter(options.delayMs, options.jitterMs));
    }
  }

  return { channels, stats };
}

export function mergeStats(
  target: EnrichBatchStats,
  source: EnrichBatchStats
): void {
  target.processed += source.processed;
  target.enriched += source.enriched;
  target.skipped += source.skipped;
  target.failed += source.failed;
  target.locked += source.locked;
  if (source.stoppedEarly) {
    target.stoppedEarly = true;
    target.stopReason = source.stopReason;
  }
}
