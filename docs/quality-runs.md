# Two quality runs

Same gate (`src/lib/quality-gate.ts`). Soft updates: every scored row gets
`quality_pass`, fail reasons, engagement, activity — nothing is deleted.

## 1) Existing database — `quality:db`

Scores channels already in `channels` that have no `quality_scored_at`.

```bash
npm run quality:db
```

Default: up to **5,000** channels, **~6,000** YouTube units, all countries.

- Pass → `quality_pass = true` (use this filter in the app)
- Fail → `quality_pass = false` + reasons (still in DB)

More / less:

```bash
npm run score:quality -- --all-countries --limit 9000 --max-units 9000
```

## 2) New quality data — `quality:new`

Adds **new** creators from TubeCensus stream, then scores them.

```bash
npm run quality:new
```

Steps:

1. Stream ~60k UC ids online → `channel_seed` (0 quota, no big download)
2. Validate → upsert into `channels` (~1,500 units)
3. Quality score unscored rows (~5,500 units) — includes the new ones

Optional:

```bash
npm run quality:new -- --seed-limit 30000 --validate-units 1000 --score-units 5000
npm run quality:new -- --skip-stream   # seeds already in channel_seed
```

## Same day (both)

```bash
npm run quality:db    # first: clean existing library
npm run quality:new   # then: grow with new quality-scored creators
```

Watch total units (~6k + ~7k). Prefer one heavy run per day on a single key,
or split across days.