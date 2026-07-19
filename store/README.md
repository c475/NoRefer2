# Store submission package

Everything needed to list NoRefer 2 on the Chrome Web Store and Firefox AMO.

## Assets
- `../dist/norefer2-<version>-chrome.zip` — Chrome upload (run `../package.sh`)
- `../dist/norefer2-<version>-firefox.zip` — Firefox upload / source
- `screenshot-1.png` — 1280×800 store screenshot
- `LISTING.md` — name, summary, description, category, single-purpose,
  permission justifications, data-usage answers (copy/paste into both stores)
- `../PRIVACY.md` — privacy policy (source it from the repo raw URL if a
  store demands a hosted policy)

## Publish scripts
- `publish-chrome.sh` — CWS API upload + publish
- `publish-firefox.sh` — AMO `web-ext sign --channel=listed`

Both read credentials from the repo `.env` and are one-command once the
accounts exist.

## Manual steps that require a human (can't be automated)

These sit behind Google/Firefox logins, one-time fees, and legal developer
agreements — none of which an agent should clear on its own:

**Chrome Web Store**
1. Register a developer account — **one-time $5 fee**, accept the CWS
   developer agreement (behind Google login for `ccfirst14`).
2. Create the item once (upload `dist/…-chrome.zip`), fill the listing from
   `LISTING.md`, add `screenshot-1.png`, answer the privacy tab, submit.
3. (For scripted future releases) enable the Chrome Web Store API in a GCP
   project, mint an OAuth client + refresh token, drop
   `CWS_CLIENT_ID/SECRET/REFRESH_TOKEN/ITEM_ID` in `.env`, then
   `./store/publish-chrome.sh`.

**Firefox AMO**
1. Sign in with a Firefox account, accept the AMO agreement (free).
2. Generate a JWT API credential at
   https://addons.mozilla.org/developers/addon/api/key/ and put
   `AMO_JWT_ISSUER` / `AMO_JWT_SECRET` in `.env`.
3. `./store/publish-firefox.sh` — uploads, signs, and queues for review.
   Fill the listing text from `LISTING.md` in the AMO dashboard.

Both stores then run a review (hours to a few days) before the extension is
publicly installable.
