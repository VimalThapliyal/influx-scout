# Influx Scout — Windows (for teams)

## What teammates need
1. Unzip **`Influx Scout-1.0.0-win.zip`**
2. Run **`Influx Scout.exe`** (SmartScreen → More info → Run anyway)
3. Paste **their own YouTube Data API key** → Save → Start scout

They do **not** need Supabase URL or service role — your DB is baked in when you build.

## What you (owner) do before shipping
```bash
cd influx-scout
npm run bake          # pulls URL + service role from ../.env.local
npm run dist:win      # builds zip with baked config
```

Send only the zip. Do **not** email service role keys.

## Model
| Who | Provides |
|-----|----------|
| Owner | Supabase (baked into the app build) |
| Each teammate | Their YouTube API key (their quota) |

All teams write into **your** `channels` table.

## Security note
The service role is hidden from the UI, but a motivated person can still dig it out of the app files. Ship only to people you trust; rotate the key if a build leaks.

## Defaults
- Run until quota ends
- Rotate all niches
- Comment mining off
- Hard quality on
