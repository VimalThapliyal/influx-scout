# Influx Contributor — for friends (Windows)

Grow the shared Influx YouTube library from your PC. You use **your own** YouTube Data API key. Vimal gives you a personal worker key.

## 1. Ask for a worker key

Contact: **the person who sent you this app**

Subject: `Influx worker key request`

Include your name. You will get an `iw_…` key (do not share it).

## 2. Get a free YouTube API key

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or pick one)
3. Enable **YouTube Data API v3**
4. Create credentials → **API key**
5. Copy the key (keep it private)

## 3. Install the Windows app

1. Unzip `Influx Contributor-*-win.zip` (or run the Setup `.exe` if you received that)
2. Open **Influx Contributor**
3. On **Dashboard**, fill in:
   - API URL: `https://influencer-platform-mu.vercel.app`
   - Worker key: `iw_…` from Vimal
   - YouTube API key: yours from Google
4. Click **Save**

## 4. Run both scrapers

1. **Start loop** on Dashboard (list import + enrich)
2. Switch to **YouTube crawl** tab
3. Click **Start auto-save** on the floating INFLUX bar

You and Vimal never process the same seed URLs or pending channels — the server assigns work uniquely.

## Need help?

Contact **the person who sent you this app**
