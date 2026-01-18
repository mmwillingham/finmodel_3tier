-- Migration: Add plaid_items table for Plaid integration
-- This table stores Plaid access tokens and metadata for connected bank accounts

CREATE TABLE IF NOT EXISTS plaid_items (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id VARCHAR(255) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,  -- Encrypted Plaid access token
    institution_id VARCHAR(255),
    institution_name VARCHAR(255),
    webhook TEXT,
    error JSONB,
    available_products JSONB,
    billed_products JSONB,
    consent_expiration_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_successful_update TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_plaid_items_owner_id ON plaid_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id ON plaid_items(item_id);

-- Add comment to table
COMMENT ON TABLE plaid_items IS 'Stores Plaid access tokens and metadata for connected bank accounts';
