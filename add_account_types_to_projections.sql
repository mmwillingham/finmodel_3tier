-- Migration: Add account type to existing projections
-- This script updates the accounts_json field in existing projections to include
-- a default 'type' field for each account if it doesn't already exist.
--
-- Background: The AccountSchema now requires a 'type' field, but older projections
-- may not have this field in their accounts_json. This migration ensures all
-- accounts have a type field set to a default value.

-- Step 1: Create a function to add type to accounts JSON if missing
CREATE OR REPLACE FUNCTION add_type_to_accounts_json(accounts_json_text TEXT)
RETURNS TEXT AS $$
DECLARE
    accounts_array JSONB;
    account JSONB;
    updated_accounts JSONB := '[]'::JSONB;
BEGIN
    -- Parse the JSON string
    accounts_array := accounts_json_text::JSONB;
    
    -- Handle NULL or empty JSON
    IF accounts_array IS NULL OR jsonb_array_length(accounts_array) = 0 THEN
        RETURN accounts_json_text;
    END IF;
    
    -- Loop through each account and add 'type' if missing
    FOR account IN SELECT * FROM jsonb_array_elements(accounts_array)
    LOOP
        -- If the account doesn't have a 'type' field, add a default one
        IF NOT (account ? 'type') THEN
            account := account || jsonb_build_object('type', 'Other/Custom');
        END IF;
        
        -- Add the updated account to the result array
        updated_accounts := updated_accounts || jsonb_build_array(account);
    END LOOP;
    
    RETURN updated_accounts::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Update all projections that have accounts_json
-- Only update if accounts_json is not null and not empty
UPDATE projections
SET accounts_json = add_type_to_accounts_json(accounts_json)
WHERE accounts_json IS NOT NULL
  AND accounts_json != ''
  AND accounts_json != '[]';

-- Step 3: Display summary of updated projections
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM projections
    WHERE accounts_json IS NOT NULL
      AND accounts_json != ''
      AND accounts_json != '[]';
    
    RAISE NOTICE 'Migration complete. Processed % projections with accounts_json.', updated_count;
END $$;

-- Step 4: Clean up the temporary function (optional - comment out if you want to keep it)
-- DROP FUNCTION IF EXISTS add_type_to_accounts_json(TEXT);
