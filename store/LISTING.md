# Store listing copy — NoRefer 2

Shared source of truth for the Chrome Web Store and Firefox AMO listings.

## Name
NoRefer 2

## Summary / short description (≤132 chars, Chrome)
Per-domain HTTP header editor. Set, append, or strip any request or response header, scoped to the sites you choose.

## Category
Chrome: **Developer Tools** (secondary: Privacy & Security)
AMO: **Privacy & Security** (also Developer Tools)

## Language
English (US)

## Detailed description

NoRefer 2 lets you rewrite HTTP headers on the sites you choose — the modern
successor to the original NoRefer extension, rebuilt on Manifest V3.

WHAT YOU CAN DO
• Set, remove, or append any header
• Edit both request headers (sent by your browser) and response headers
  (sent back by the server)
• Scope each rule to specific domains — subdomains included automatically —
  or apply it everywhere
• Match by the target host, by the page the request comes from, or by a URL
  filter like ||example.com/api/*
• Order rules to control which one wins when two touch the same header
• See a per-tab badge counting the rules active on the current site, and flip
  everything off with one master switch

COMMON USES
• Strip the Referer header for privacy
• Send Do-Not-Track / Global Privacy Control signals
• Spoof a User-Agent on a specific site
• Drop Content-Security-Policy or set Access-Control-Allow-Origin while
  developing locally
• Add an Authorization or custom header to an internal API you're testing

FAST AND PRIVATE
Headers are rewritten by the browser's own declarativeNetRequest engine, so
edits apply natively without any extension code sitting on your traffic.
Everything is stored locally on your device. No accounts, no telemetry, no
servers, no data collection.

Presets get you started in one click, and you can import/export your rules as
JSON — including an importer for configs from the original NoRefer.

Open source (MIT): https://github.com/c475/NoRefer2

## Single purpose (Chrome required field)
NoRefer 2 has a single purpose: to let the user add, modify, or remove HTTP
request and response headers on domains they specify.

## Permission justifications (Chrome required)

declarativeNetRequest — The extension's entire function is modifying HTTP
headers. It uses declarativeNetRequest's modifyHeaders action to apply the
user's header rules natively, without reading request contents.

storage — Stores the user's header rules and on/off state locally so they
persist between sessions. Nothing is sent anywhere.

host permissions (<all_urls>) — Header rules can target any site the user
chooses, so the extension must be able to register header-modification rules
for arbitrary hosts. The extension does not read page content; it only
applies the user's declarative header rules. Requests to hosts the user has
not written a rule for are unaffected.

## Data usage disclosures (Chrome Privacy tab)
- Does the extension collect user data? NO.
- Not sold to third parties; not used for anything unrelated to the single
  purpose; not used for creditworthiness/lending.
- All configuration stays in local browser storage.

## Privacy policy
Not required (no data collected). If a URL is demanded, point to:
https://github.com/c475/NoRefer2/blob/main/PRIVACY.md
