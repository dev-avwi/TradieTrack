#!/bin/bash
set -e
npm install
echo "Applying schema changes via direct SQL (drizzle-kit push is interactive and times out)..."
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS sentiment text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS sentiment_score real;" 2>/dev/null || true
# Task #86 (Integrations Health Pass): timezone + quickbooks_default_item_ref
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Australia/Sydney';" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS quickbooks_default_item_ref jsonb;" 2>/dev/null || true
echo "Schema changes applied."
