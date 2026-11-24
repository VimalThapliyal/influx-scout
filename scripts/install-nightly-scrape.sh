#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_LABEL="com.influx.scrape-nightly"
LEGACY_PLIST_LABEL="com.influencerintel.scrape-nightly"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_DIR="$PROJECT_DIR/scripts/logs"
NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"

if [[ -z "$NPM_BIN" ]]; then
  echo "npm not found in PATH. Install Node.js first."
  exit 1
fi

mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd "${PROJECT_DIR}" &amp;&amp; "${NPM_BIN}" run scrape:niches >> "${LOG_DIR}/launchd.log" 2>&amp;1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/launchd.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/launchd.stderr.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${LEGACY_PLIST_LABEL}" 2>/dev/null || true
launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

echo ""
echo "Installed nightly scraper."
echo "  Project:  $PROJECT_DIR"
echo "  Schedule: every day at 2:00 AM (local time)"
echo "  Plist:    $PLIST_PATH"
echo "  Logs:     $LOG_DIR/"
echo ""
echo "Commands:"
echo "  npm run scrape:niches -- --dry-run   # preview tonight's plan"
echo "  npm run scrape:niches                # run manually now"
echo "  launchctl kickstart -k gui/$(id -u)/${PLIST_LABEL}   # trigger now"
echo "  launchctl bootout gui/$(id -u)/${PLIST_LABEL}        # uninstall"
echo ""
echo "Requires: Mac awake at 2 AM, or enable Power Nap / prevent sleep."
