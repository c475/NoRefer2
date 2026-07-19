#!/usr/bin/env bash
#
# Sign + submit NoRefer 2 to Firefox AMO as a listed add-on, via web-ext.
#
# One-time setup the account owner must do by hand (behind a Firefox account
# login, not automatable):
#   1. Create/sign in to a Firefox account.
#   2. Generate an API credential at
#      https://addons.mozilla.org/developers/addon/api/key/
#      -> JWT issuer + secret.
#
# Then put these in the repo .env (or the environment):
#   AMO_JWT_ISSUER, AMO_JWT_SECRET
#
# web-ext uploads, AMO validates/signs, and (channel=listed) queues it for
# review + public listing. Add --amo-metadata for listing fields on first
# submission; subsequent versions reuse the stored listing.
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

: "${AMO_JWT_ISSUER:?set AMO_JWT_ISSUER}"
: "${AMO_JWT_SECRET:?set AMO_JWT_SECRET}"

npx --yes web-ext sign \
  --channel=listed \
  --api-key="$AMO_JWT_ISSUER" \
  --api-secret="$AMO_JWT_SECRET" \
  --source-dir=. \
  --ignore-files 'test/**' 'store/**' 'docs/**' 'dist/**' 'package.sh' '*.md' \
  --artifacts-dir=dist

echo "done — submitted to AMO for review."
