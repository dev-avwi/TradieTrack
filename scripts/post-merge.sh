#!/bin/bash
set -e
npm install
echo "Applying schema changes via direct SQL (drizzle-kit push is interactive and times out)..."
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS sentiment text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS sentiment_score real;" 2>/dev/null || true
# Task #86 (Integrations Health Pass): timezone + quickbooks_default_item_ref
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Australia/Sydney';" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS quickbooks_default_item_ref jsonb;" 2>/dev/null || true
# Accounting integration tax/item refs + webhook tracking (sync gap fix)
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_sales_account_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_sales_account_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS myob_income_account_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_tax_rate_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_default_item_code text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_active_tenant_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_last_webhook_at timestamp;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_tax_rate_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_default_item_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_last_webhook_at timestamp;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS myob_tax_code_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS myob_default_item_id text;" 2>/dev/null || true
echo "Schema changes applied."
