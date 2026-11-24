# YouTube API key setup

Use one official Google Cloud project and request a YouTube API quota extension
when the product needs more capacity. Creating projects or accounts to evade
quota limits risks suspension.

## Automated setup

Install Google Cloud CLI:

```bash
brew install --cask google-cloud-sdk
gcloud auth login
```

For an existing project:

```bash
npm run youtube:key:setup -- YOUR_PROJECT_ID
```

To intentionally create one new project:

```bash
npm run youtube:key:setup -- YOUR_UNIQUE_PROJECT_ID --create
```

The script enables YouTube Data API v3, creates one key restricted to that API,
and prints the `YOUTUBE_API_KEY=...` line. It never writes the secret to Git or
`.env.local` automatically.

## Manual setup

1. Open [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Select or create a project.
3. APIs & Services → Library → enable **YouTube Data API v3**.
4. APIs & Services → Credentials → Create credentials → API key.
5. Restrict the key to **YouTube Data API v3**.
6. Add it to `.env.local` as `YOUTUBE_API_KEY=...`.

## More quota

YouTube API quota cannot be purchased. Apply through Google's official YouTube
API Services audit/quota-extension process and document the product, request
volume, privacy policy, and 30-day refresh/deletion handling.

Team members may use their own keys for genuinely independent usage in Scout,
but keys should not be pooled to bypass a project's quota.