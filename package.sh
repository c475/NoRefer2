#!/usr/bin/env bash
# Build store-ready zips for Chrome and Firefox from the single codebase.
# The manifest is shared: Chrome ignores browser_specific_settings and
# background.scripts; Firefox ignores background.service_worker.
set -euo pipefail
cd "$(dirname "$0")"

python3 - <<'EOF'
import json, pathlib, shutil, zipfile

version = json.load(open("manifest.json"))["version"]
out = pathlib.Path("dist")
shutil.rmtree(out, ignore_errors=True)
out.mkdir()

files = ["manifest.json", "rules.js", "background.js",
         "popup.html", "popup.css", "popup.js",
         "icons/cat16.png", "icons/cat48.png", "icons/cat128.png"]

chrome = out / f"norefer2-{version}-chrome.zip"
with zipfile.ZipFile(chrome, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(f)
shutil.copy(chrome, out / f"norefer2-{version}-firefox.zip")
EOF

echo "built:"
ls -l dist
