#!/usr/bin/env bash
# Build the Vite app and publish app/dist to the gh-pages branch (GitHub Pages).
# No GitHub Actions / workflow scope required — works with a plain `repo` token.
# Usage:  npm run deploy   (from app/)   or   bash scripts/deploy-pages.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="$(git -C "$ROOT" remote get-url origin)"

echo "▸ Building app/ …"
cd "$ROOT/app"
npm run build

DIST="$ROOT/app/dist"
TMP="$(mktemp -d)"
cp -R "$DIST"/. "$TMP"/
touch "$TMP/.nojekyll"          # serve files/dirs as-is (no Jekyll processing)

echo "▸ Publishing to gh-pages …"
cd "$TMP"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.email="deploy@tonecanvas" -c user.name="Tone Canvas Deploy" \
    commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -q -f "$REMOTE" gh-pages
cd "$ROOT"
rm -rf "$TMP"
echo "✓ Deployed. Pages will update at the site URL in ~1 min."
