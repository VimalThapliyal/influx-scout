# TubeCensus → validate → score pipeline

Turns a giant seed list of raw YouTube channel identifiers (TubeCensus, ~100M+)
into validated, scored rows in `channels` — while spending the absolute minimum
YouTube API quota.

```
TubeCensus file (local, ~16 GB)
        │  npm run census:import      (0 quota)
        ▼
  channel_seed pool  ──────────────┐  raw ids, deduped, status='new'
        │  npm run census:validate  │  (batched channels.list, 1 unit / 50)
        ▼                           │
     channels  (validated + scored) ┘  seeds marked validated / dead / skipped
```

## 1. Apply the migration

Run `supabase/migrations/020_channel_seed.sql` in the Supabase SQL editor (or your
migration runner). It creates the `channel_seed` index table.

## 2. Import a seed file (zero quota)

Download TubeCensus from Zenodo first, then point `--file` at any CSV/TSV/TXT
(optionally `.gz`). Cells can be full URLs, bare paths, bare `UC…` ids or `@handles`.

```bash
npm run census:import -- --file ./data/tubecensus.csv
npm run census:import -- --file ./data/ids.txt.gz --limit 500000
npm run census:import -- --file ./data/tubecensus.csv --column channel_url
npm run census:import -- --file ./data/tubecensus.csv --formats channel   # canonical only
npm run census:import -- --file ./data/tubecensus.csv --dry-run           # counts only
```

Identifier formats and their validation cost:


| Format    | Example        | Validation cost                              |
| --------- | -------------- | -------------------------------------------- |
| `channel` | `/channel/UC…` | **1 unit / 50** (best)                       |
| `handle`  | `/@name`       | 1 unit each                                  |
| `user`    | `/user/Name`   | 1 unit each                                  |
| `custom`  | `/c/Slug`      | search only (100 units — skipped by default) |


Prefer importing/validating `channel` seeds first: 10M canonical ids cost only
~~200k units to validate (~~20 days at the free 10k/day, or faster with more keys).

## 3. Validate into the library (cheap)

```bash
npm run census:validate                        # 4000 canonical seeds (~80 units)
npm run census:validate -- --limit 20000       # more per run
npm run census:validate -- --formats channel,handle
npm run census:validate -- --min-subs 1000 --min-videos 3
npm run census:validate -- --max-units 9000    # stop before daily quota runs out
npm run census:validate -- --with-activity     # also fetch latest upload date (pricier)
npm run census:validate -- --dry-run
```

What it does per run:

- Pulls `status='new'` seeds (canonical `channel` first — cheapest).
- Canonical ids → `channels.list` 50 at a time (part=snippet,statistics).
- `handle`/`user` → resolved individually (`forHandle` / `forUsername`), and the
resolved `UC…` id is written back onto the seed.
- Live channels clearing the subscriber/video floor are upserted into `channels`
(with existing niche/country classification + 30-day metrics expiry applied).
- Dead/hidden channels → `status='dead'`; too-small → `status='skipped'`, so we
never spend quota on them again.
- Stops cleanly on quota exhaustion; just re-run the next day.

`--with-activity` additionally fetches each channel's most recent upload date via
`playlistItems.list` (1 extra unit per promoted channel) for recency scoring.

## 4. Score quality (IMPORTANT)

`census:validate` only writes cheap metadata + a subs/videos floor. It does **not**
fill the quality gate (`quality_pass`, `avg_views_last5`, `engagement_last5`,
`activity_bucket`). Run the quality pass to get real quality data:

```bash
npm run score:quality -- --all-countries --unscored-only --max-units 9000
```

Cost: ~2 units per channel (uploads playlist id is derived from the channel id, so
it only spends `playlistItems.list` + `videos.list`). It pages through the whole
library, scores best-subscriber-first, and stops cleanly at `--max-units` or on
quota exhaustion — just re-run daily until `unscored` reaches 0.

The gate (see `src/lib/quality-gate.ts`) flags a channel `quality_pass = true` only
when it clears: ≥5k avg views on last 5 uploads (niche overrides apply), ≤45 days
since last upload, ≥2% engagement, ≥3 videos, and a tier-1/2 location (blank country
is a soft keep). Everything else stays in the library with scores + fail reasons —
nothing is deleted. Filter your UI/API to `quality_pass = true` for the premium set.

## Compliance note

`channels` rows carry `youtube_metrics_expires_at` (migration 015) so stored API
metrics are refreshed/expired within YouTube's 30-day policy window. Seeds in
`channel_seed` are just identifiers (public, non-expiring), not API payloads.