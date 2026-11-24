# YouTube Influencer Platform (Free Tier)

A **$0/month** YouTube influencer discovery tool built with **Next.js + Vercel + Supabase + YouTube Data API**.

## Features

- Keyword-based channel discovery
- Influencer scoring and tier classification (nano → mega)
- Channel database with search and filters
- Campaign list building and CSV export
- Daily channel refresh via Vercel Cron
- API quota tracking (10,000 units/day)

## Stack

| Service | Purpose | Cost |
|---------|---------|------|
| Vercel | Frontend + API | Free |
| Supabase | PostgreSQL database | Free |
| YouTube Data API v3 | Channel data | Free (10K units/day) |

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
| More API quota | Additional Google Cloud projects |

## Related Docs

- Full free-tier PRD: `../doc.prd.free.md`
- Original paid PRD: `../doc.prd`
