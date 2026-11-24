#!/usr/bin/env bash
set -euo pipefail

# Official one-project YouTube Data API setup.
# This intentionally does not create project/key farms to bypass API quotas.

usage() {
  cat <<'EOF'
Usage:
  npm run youtube:key:setup -- PROJECT_ID [--create]

Examples:
  npm run youtube:key:setup -- my-existing-project
  npm run youtube:key:setup -- influx-youtube-prod --create

What it does:
  1. Verifies gcloud login
  2. Optionally creates ONE Google Cloud project
  3. Enables YouTube Data API v3 and API Keys API
  4. Creates one key restricted to youtube.googleapis.com
  5. Prints the .env.local line to copy

The script never writes the key to Git or .env.local automatically.
EOF
}

if [[ $# -lt 1 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

PROJECT_ID="$1"
CREATE_PROJECT=false
if [[ "${2:-}" == "--create" ]]; then
  CREATE_PROJECT=true
elif [[ $# -gt 1 ]]; then
  echo "Unknown option: $2" >&2
  usage
  exit 2
fi

if ! command -v gcloud >/dev/null 2>&1; then
  cat >&2 <<'EOF'
gcloud is not installed.

macOS install:
  brew install --cask google-cloud-sdk

Then open a new terminal and run:
  gcloud auth login
EOF
  exit 1
fi

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | sed -n '1p')"
if [[ -z "$ACCOUNT" ]]; then
  echo "No active Google account. Run: gcloud auth login" >&2
  exit 1
fi

echo "Google account: $ACCOUNT"
echo "Project:        $PROJECT_ID"

if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  if [[ "$CREATE_PROJECT" != true ]]; then
    echo "Project does not exist (or you cannot access it)." >&2
    echo "To create it intentionally, rerun with --create." >&2
    exit 1
  fi

  echo "Creating one Google Cloud project…"
  gcloud projects create "$PROJECT_ID" \
    --name="Influx YouTube API" \
    --set-as-default
else
  gcloud config set project "$PROJECT_ID" >/dev/null
fi

echo "Enabling required APIs (this can take a minute)…"
gcloud services enable \
  serviceusage.googleapis.com \
  apikeys.googleapis.com \
  youtube.googleapis.com \
  --project="$PROJECT_ID"

KEY_ID="influx-youtube-$(date +%Y%m%d%H%M%S)"
echo "Creating a key restricted to YouTube Data API v3…"

# create's --format sometimes returns empty; fetch keyString explicitly afterwards
gcloud services api-keys create \
  --project="$PROJECT_ID" \
  --key-id="$KEY_ID" \
  --display-name="Influx YouTube Data API" \
  --api-target=service=youtube.googleapis.com \
  >/dev/null

KEY_STRING="$(
  gcloud services api-keys get-key-string "$KEY_ID" \
    --project="$PROJECT_ID" \
    --format='value(keyString)'
)"

if [[ -z "$KEY_STRING" ]]; then
  echo "Key was created but its value was not returned." >&2
  echo "Retrieve it with:" >&2
  echo "  gcloud services api-keys get-key-string $KEY_ID --project=$PROJECT_ID" >&2
  exit 1
fi

cat <<EOF

Success. Copy this into .env.local:

YOUTUBE_API_KEY=$KEY_STRING

Security:
  - Do not commit or share this value.
  - The key is restricted to YouTube Data API v3.
  - Rotate it immediately if it leaks.

Test:
  npm run score:quality -- --limit 5 --all-countries --dry-run

For more quota, use Google's official YouTube API audit/quota-extension process;
do not shard traffic across projects to evade quota limits.
EOF
