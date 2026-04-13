#!/bin/bash
set -e
npm install
echo "Applying schema changes via direct SQL (drizzle-kit push is interactive and times out)..."
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS sentiment text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS sentiment_score real;" 2>/dev/null || true
echo "Schema changes applied."
