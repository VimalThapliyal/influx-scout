import { NextRequest } from "next/server";
import {
  authenticateWorker,
  extractBearerToken,
  recordWorkerSubmit,
} from "@/lib/worker-auth";
import { importChannelsFromText } from "@/lib/worker-import";
import { lightSaveChannels, type LightChannelInput } from "@/lib/worker-light";
import {
  extractChannelsFromListPages,
  isYouTubeChannelUrl,
  normalizeChannelUrl,
} from "@/lib/list-extract";
import {
  workerJsonResponse,
  workerOptionsResponse,
} from "@/lib/worker-cors";
import { getQuotaResetNote, isQuotaError } from "@/lib/quota";

export async function OPTIONS() {
  return workerOptionsResponse();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const worker = await authenticateWorker(token);

  if (!worker) {
    return workerJsonResponse(
      { error: "Invalid or missing worker key. Use Authorization: Bearer iw_…" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const mode = body.mode === "full" ? "full" : "light";
    const usaOnly = body.usa_only !== false;
    const minSubscribers =
      typeof body.min_subscribers === "number" && body.min_subscribers >= 0
        ? body.min_subscribers
        : 0;

    // --- Light save: zero YouTube API quota ---
    if (mode === "light") {
      const channels: LightChannelInput[] = Array.isArray(body.channels)
        ? body.channels
            .filter((c: unknown) => c && typeof c === "object")
            .map((c: Record<string, unknown>) => ({
              url: typeof c.url === "string" ? c.url : "",
              channel_id:
                typeof c.channel_id === "string" ? c.channel_id : null,
              handle: typeof c.handle === "string" ? c.handle : null,
              title: typeof c.title === "string" ? c.title : null,
              subscriber_count:
                typeof c.subscriber_count === "number"
                  ? c.subscriber_count
                  : null,
              thumbnail_url:
                typeof c.thumbnail_url === "string" ? c.thumbnail_url : null,
            }))
        : [];

      if (channels.length === 0 && Array.isArray(body.urls)) {
        for (const u of body.urls) {
          if (typeof u === "string") channels.push({ url: u });
        }
      }

      const listUrls: string[] = Array.isArray(body.list_urls)
        ? body.list_urls.filter((u: unknown) => typeof u === "string")
        : [];

      let listPages:
        | Array<{ url: string; count: number; error?: string }>
        | undefined;

      if (typeof body.text === "string" && body.text.trim()) {
        for (const line of body.text.split("\n")) {
          const t = line.trim();
          if (!t) continue;
          if (isYouTubeChannelUrl(t)) {
            const n = normalizeChannelUrl(t);
            if (n) channels.push({ url: n });
          } else if (/^https?:\/\//i.test(t)) {
            listUrls.push(t);
          } else if (t.startsWith("@")) {
            channels.push({ url: `https://www.youtube.com/${t}` });
          }
        }
      }

      if (listUrls.length > 0) {
        const extracted = await extractChannelsFromListPages(
          Array.from(new Set(listUrls)).slice(0, 10)
        );
        listPages = extracted.pages;
        for (const u of extracted.channels) {
          channels.push({ url: u });
        }
      }

      const seen = new Set<string>();
      const unique: LightChannelInput[] = [];
      for (const c of channels) {
        const key = (c.url || "")
          .split(/[?#]/)[0]
          .replace(/\/$/, "")
          .toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(c);
      }

      if (unique.length === 0) {
        return workerJsonResponse(
          {
            error:
              "No channels found. Paste YouTube @handles/URLs, or roundup page URLs.",
            list_pages: listPages,
          },
          { status: 400 }
        );
      }

      let imported = 0;
      let already_saved = 0;
      let already_pending = 0;
      let skipped_below_min_subs = 0;
      let failed = 0;
      const errors: Array<{ input: string; error: string }> = [];
      const savedChannels: Awaited<
        ReturnType<typeof lightSaveChannels>
      >["channels"] = [];

      for (const batch of chunk(unique, 50)) {
        const result = await lightSaveChannels(batch, {
          minSubscribers,
          workerId: worker.id,
        });
        imported += result.imported;
        already_saved += result.already_saved;
        already_pending += result.already_pending;
        skipped_below_min_subs += result.skipped_below_min_subs;
        failed += result.failed;
        errors.push(...result.errors);
        savedChannels.push(...result.channels);
      }

      await recordWorkerSubmit(worker, unique.length, imported);

      const alreadyKnown = already_saved > 0 || already_pending > 0;

      return workerJsonResponse({
        ok: true,
        mode: "light",
        worker: worker.name,
        submitted: unique.length,
        imported: imported > 0 || alreadyKnown ? Math.max(1, imported) : 0,
        queued: imported,
        already_saved,
        already_pending,
        skipped_below_min_subs,
        failed,
        errors: errors.slice(0, 20),
        channels: savedChannels.slice(0, 50),
        list_pages: listPages,
        message:
          imported > 0
            ? `Queued ${imported} channel(s) for nightly enrich (0 YouTube API quota).`
            : alreadyKnown
              ? "Already in library or pending queue."
              : "Nothing queued.",
      });
    }

    // --- Full save: YouTube API enrich immediately ---
    const urls: string[] = Array.isArray(body.urls)
      ? body.urls.filter((u: unknown) => typeof u === "string")
      : [];
    const text =
      typeof body.text === "string" ? body.text : urls.join("\n");

    if (!text.trim()) {
      return workerJsonResponse(
        { error: "Provide urls[] or text with YouTube channel links" },
        { status: 400 }
      );
    }

    const result = await importChannelsFromText(text, {
      usaOnly,
      targetMarketsOnly: body.target_markets_only === true && !usaOnly,
      minSubscribers,
    });

    await recordWorkerSubmit(worker, result.submitted, result.imported);

    return workerJsonResponse({
      ok: true,
      mode: "full",
      worker: worker.name,
      ...result,
      message:
        result.imported > 0
          ? `Saved ${result.imported} channel(s) to Influx. Run nightly scrape for emails if missing.`
          : result.skipped_below_min_subs > 0
            ? `Skipped ${result.skipped_below_min_subs} channel(s) below min subscribers.`
            : "No channels imported. Check USA filter or URLs.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    const quotaExceeded = isQuotaError(error);
    const status = quotaExceeded ? 429 : 500;
    return workerJsonResponse(
      {
        error: message,
        quota_exceeded: quotaExceeded,
        reset_note: quotaExceeded ? getQuotaResetNote() : undefined,
      },
      { status }
    );
  }
}
