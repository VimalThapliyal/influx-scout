# Influx Chrome extension

Save YouTube channels to your shared Influx library while browsing search results or channel pages.

## Setup

1. Run migration `supabase/migrations/005_contributor_workers.sql` in Supabase.
2. Create keys for each contributor:
   ```bash
   npm run worker:create -- --name you
   npm run worker:create -- --name friend
   ```
3. Chrome → **Extensions** → **Manage extensions** → **Load unpacked** → select this `extension/` folder.
4. Click the extension icon → paste **API URL** and your **worker key** (`iw_…`) → Save.

Optional: set `WORKER_SUBMIT_TOKEN` in Vercel as a shared fallback token (less secure than per-user keys).

## Usage

- Search YouTube (e.g. `finance usa`) → click **Save to Influx** on channel rows.
- **Auto-save:** on a YouTube search tab, open the extension popup → **Start auto-save on this tab** (default 1 click/sec, auto-scrolls when idle).
- **Light save (default):** queues channels with **0 YouTube API quota**. Run `npm run enrich:pending` overnight to promote into the library (USA + min-subs filters applied then).
- **Related-channels crawl:** on any channel page, **Open related & crawl** scrapes the `/channels` tab and light-saves featured/related creators. New saves also enqueue related pages; auto-save visits them every 3 keyword rotations.
- **Smart keyword rotate:** **1,356 keywords** across **12 niches**:
  - Tier 1: 240 broad (`… usa`)
  - Tier 2: 180 long-tail
  - Tier 3: **936 city/state packs** (3 stems × 26 places × 12 niches — e.g. `personal finance texas`, `skincare miami`, `dog training california`)
  - Order: finance → gaming → beauty → fashion → fitness → tech → food → travel → parenting → education → pets → diy → repeat
- **Freshness:** scrolls deep, rotates filters (channel + **video search** modes), cooldown on exhausted terms.
- On a channel page → floating **Save to Influx** button (bottom-right).
- USA-only filter is on by default; non-US channels are skipped server-side.
- Min subscribers defaults to **1000** in the extension popup; channels below that show **Under min subs** and are not saved.

Emails are enriched later by `npm run scrape:niches` on a laptop with Playwright.

## Share with a friend

Send them:
- This `extension/` folder (zip or git clone)
- Their own `iw_…` key (never share the service role key)
- API URL: `https://influencer-platform-mu.vercel.app`

Both of you write to the same Supabase library; duplicates are merged by channel ID.
