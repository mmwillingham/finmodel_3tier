-- Add timestamp column to projections table
-- This migration adds the timestamp column for backward compatibility

ALTER TABLE projections 
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have a timestamp (use current time if NULL)
UPDATE projections 
SET timestamp = CURRENT_TIMESTAMP 
WHERE timestamp IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE projections 
ALTER COLUMN timestamp SET NOT NULL;
