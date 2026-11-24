# Influx Contributor

Share discovery work across laptops **without doing the same seed URLs or enriching the same pending channels**.

## For you (admin)

1. Run migration in Supabase SQL editor:
   - [`supabase/migrations/007_contributor_claims.sql`](supabase/migrations/007_contributor_claims.sql)
2. Deploy the Next.js app (claim APIs) to Vercel.
3. Fill the shared seed pool:
   ```bash
   npm run seeds:sync
   ```
4. Create a worker key per person:
   ```bash
   npm run worker:create -- --name alice
   ```
   Send them the `iw_…` key (shown once).

5. Build the Mac app:
   ```bash
   cd contributor-app
   npm install
   npm run dist:mac
   ```
   DMG lands in `contributor-app/dist/`.

## Dual scrapers (run together)

1. **List / enrich loop** (this app) — claims unique seed URLs + enriches pending  
2. **YouTube browser crawl** (Chrome extension) — auto-save / related crawl on YouTube  

Same `iw_…` worker key. Electron syncs keys to the extension via `http://127.0.0.1:17341` while the app is open.

In the app: **Start list / enrich loop** + **Open Chrome + extension** at the same time.


1. Install **Influx Contributor** from the `.dmg`.
2. Get a free [YouTube Data API key](https://console.cloud.google.com/apis/credentials) (enable YouTube Data API v3).
3. Open the app → paste:
   - API URL: `https://influencer-platform-mu.vercel.app`
   - Worker key: `iw_…` you received
   - YouTube API key: theirs
4. Click **Save**, then **Start growing**.

Keys stay on their Mac. The server assigns exclusive seed + pending leases so two people never process the same work.

## Efficiency

| Work | Coordination |
|------|----------------|
| Roundup seed URLs | `seed_urls` claim (one worker at a time) |
| Pending enrich | `channel_pending` enrich lease |
| Already in library | skipped by light-save / enrich |

If someone quits mid-run, leases expire (~30–45 min) and work returns to the pool.
