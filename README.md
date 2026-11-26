# Influx: find YouTube creators in the USA & Europe worth sponsoring

**Live site: https://influencer-platform-mu.vercel.app**

Influx filters YouTube channels down to the creators a brand can actually work with. Of ~200,000 channels scored, fewer than 5% pass:

- uploaded in the last 45 days
- 5,000+ average views on the last 5 videos (higher for some niches; 1,500+ with 3% engagement for channels under 50K subscribers)
- 2%+ engagement rate ((likes + comments) ÷ views)
- based in the US, UK, Canada, Australia or Europe

## Free, no signup

- **Creator lists by niche and country**, e.g. [fitness YouTubers in the US](https://influencer-platform-mu.vercel.app/youtubers/fitness/united-states) or [German YouTubers](https://influencer-platform-mu.vercel.app/youtubers/germany), refreshed daily
- **[YouTube engagement rate calculator](https://influencer-platform-mu.vercel.app/tools/youtube-engagement-rate-calculator)** with benchmarks by channel size
- **[YouTube sponsorship price calculator](https://influencer-platform-mu.vercel.app/tools/youtube-sponsorship-calculator)**
- **Data articles:** [engagement benchmarks by niche](https://influencer-platform-mu.vercel.app/blog/youtube-engagement-rate-benchmarks), [why subscriber count misleads](https://influencer-platform-mu.vercel.app/blog/youtube-subscribers-vs-views), [how to vet a creator](https://influencer-platform-mu.vercel.app/blog/how-to-vet-a-youtube-creator)

Creators can [remove their listing](https://influencer-platform-mu.vercel.app/remove-my-listing) at any time.

## Stack

| Service | Purpose |
|---------|---------|
| Next.js 14 on Vercel | Site, API routes, ISR pages |
| Supabase (Postgres) | Channel data, auth |
| YouTube Data API v3 | Public channel and video statistics |
| GitHub Actions | Daily validate → score pipeline |

## Quick Start

### 1. Clone and install

```bash
cd influencer-platform
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`
3. Copy your project URL and keys from **Settings → API**

### 3. Get YouTube API key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **YouTube Data API v3**
3. Create an API key under **Credentials**

### 4. Configure environment

```bash
cp .env.example .env.local
```

Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
YOUTUBE_API_KEY=AIza...
CRON_SECRET=any-random-string
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Deploy to Vercel

```bash
npx vercel
```

Add the same env vars in Vercel dashboard. Cron job runs daily at 6:00 UTC (see `vercel.json`).

## API Quota Budget

| Operation | Cost | Daily max |
|-----------|------|-----------|
| Search | 100 units | ~50 searches |
| Channel details | 1 unit (50 IDs) | ~5,000 channels |

## Project Structure

```
influencer-platform/
├── src/
│   ├── app/
│   │   ├── api/          # Serverless API routes
│   │   ├── discover/     # Search UI
│   │   ├── channels/     # Browse saved channels
│   │   └── campaigns/    # Campaign management
│   └── lib/
│       ├── youtube.ts    # YouTube API client
│       ├── scoring.ts    # Influencer scoring
│       ├── quota.ts      # Quota tracking
│       └── supabase.ts   # Database client
└── supabase/
    └── migrations/       # Database schema
```

## Free Tier Limits

- ~50 YouTube searches per day
- ~50,000–100,000 channels in database (500MB Supabase limit)
- ~5–15% email extraction (from API description only)
- No web scraping (requires paid proxies + workers)

## Upgrade Path

When you outgrow free tier:

| Need | Solution |
|------|----------|
| More DB space | Supabase Pro ($25/mo) |
| Email scraping | Railway worker + Playwright |
| More API quota | YouTube API quota extension request (audit) |
