#!/usr/bin/env bash
# Sync Spark dossier public slice → this repo. Never copies drop/private.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/content/public"
mkdir -p "$DEST"

if ! ssh -o BatchMode=yes -o ConnectTimeout=10 spark 'test -d ~/Projects/dossier/drop/public'; then
  echo "Cannot reach spark:~/Projects/dossier/drop/public" >&2
  exit 1
fi

rsync -az --delete --exclude '.DS_Store' \
  -e "ssh -o BatchMode=yes" \
  spark:~/Projects/dossier/drop/public/ \
  "$DEST/"

node "$ROOT/scripts/bundle-public.mjs"
echo "Synced public dossier → $DEST"
