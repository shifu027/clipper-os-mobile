#!/usr/bin/env bash
# setup-env.sh — Copy .env.example to .env if .env does not exist.
# Run this once after cloning the repository to get started quickly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

if [ ! -f "$ENV_EXAMPLE" ]; then
  echo "❌  .env.example not found in $ROOT_DIR"
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  echo "✅  .env already exists — no changes made."
else
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "✅  Created .env from .env.example"
  echo ""
  echo "👉  Open .env and fill in your values:"
  echo "     VITE_SUPABASE_URL=https://your-project.supabase.co"
  echo "     VITE_SUPABASE_ANON_KEY=your-anon-key"
fi
