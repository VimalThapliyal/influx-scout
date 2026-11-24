# Influx Scout

Desktop app to **find and enrich** YouTube creators using the one-pager flow:

1. Keyword + This week / This month (recent **videos** → unique channels)
2. Optional **comment authors** on those videos
3. **Last-5 quality score** (views ≥5k, upload ≤45d, engagement ≥2%, Tier 1/2)
4. Upsert into your Supabase `channels` table

Related / featured channels stay in the **Chrome extension** (Contributor).

## Setup

```bash
cd influx-scout
npm install
npm start
```

Paste:

- YouTube Data API key only (your quota)

Owner bakes Supabase into the build via `npm run bake` (from `.env.local`).  
Run migration `019_quality_activity_gates.sql` so quality fields persist.


## Usage

1. Pick a **niche** (go 200–300 deep before switching)
2. Choose **This week** or **This month**
3. Set **target depth** (e.g. 250)
4. Optionally enable comment mining
5. **Start scout**

## Build

```bash
npm run dist:mac   # or dist:win
```
