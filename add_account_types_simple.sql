-- Alternative Migration: Add account type to existing projections
-- This is a simpler version that directly updates the JSON using PostgreSQL's JSON functions
--
-- This script adds a default 'type' field to each account in the accounts_json
-- if the account doesn't already have a 'type' field.

-- Update projections to add 'type' to accounts that don't have it
UPDATE projections
SET accounts_json = (
    SELECT jsonb_agg(
        CASE 
            WHEN account ? 'type' THEN account
            ELSE account || jsonb_build_object('type', 'Other/Custom')
        END
    )::TEXT
    FROM jsonb_array_elements(accounts_json::JSONB) AS account
)
WHERE accounts_json IS NOT NULL
  AND accounts_json != ''
  AND accounts_json != '[]'
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(accounts_json::JSONB) AS account
    WHERE NOT (account ? 'type')
  );

-- Display the number of updated projections
SELECT COUNT(*) AS "Projections Updated"
FROM projections
WHERE accounts_json IS NOT NULL
  AND accounts_json != ''
  AND accounts_json != '[]';
