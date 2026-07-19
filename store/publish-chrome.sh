#!/usr/bin/env bash
#
# Upload + publish NoRefer 2 to the Chrome Web Store via the CWS API.
#
# One-time setup the store account owner must do by hand (behind Google login,
# not automatable):
#   1. Register as a Chrome Web Store developer ($5 one-time fee).
#   2. Create the item once (upload any zip) to mint its item id.
#   3. In a GCP project, enable the "Chrome Web Store API" and create an
#      OAuth client (type: Desktop). Run the one-time consent to mint a
#      refresh token for the developer account.
#
# Then put these in the repo .env (or the environment):
#   CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_ITEM_ID
#
# After that, every release is just: ./store/publish-chrome.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

: "${CWS_CLIENT_ID:?set CWS_CLIENT_ID}"
: "${CWS_CLIENT_SECRET:?set CWS_CLIENT_SECRET}"
: "${CWS_REFRESH_TOKEN:?set CWS_REFRESH_TOKEN}"
: "${CWS_ITEM_ID:?set CWS_ITEM_ID}"

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
./package.sh >/dev/null
ZIP="dist/norefer2-$VERSION-chrome.zip"

echo "› exchanging refresh token…"
TOKEN=$(curl -s "https://oauth2.googleapis.com/token" \
  -d client_id="$CWS_CLIENT_ID" \
  -d client_secret="$CWS_CLIENT_SECRET" \
  -d refresh_token="$CWS_REFRESH_TOKEN" \
  -d grant_type=refresh_token | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

echo "› uploading $ZIP …"
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-api-version: 2" \
  -X PUT -T "$ZIP" \
  "https://www.googleapis.com/upload/chromewebstore/v1.1/items/$CWS_ITEM_ID" | python3 -m json.tool

echo "› publishing…"
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-api-version: 2" \
  -H "Content-Length: 0" \
  -X POST \
  "https://www.googleapis.com/chromewebstore/v1.1/items/$CWS_ITEM_ID/publish" | python3 -m json.tool

echo "done — new version goes to Google review before going live."
