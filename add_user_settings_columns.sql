-- Add missing columns to user_settings table (PostgreSQL)
-- This migration adds several new columns to the user_settings table,
-- including default values for existing rows and ensuring NOT NULL constraint for new inserts.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS asset_categories VARCHAR(255) DEFAULT 'Real Estate,Vehicles,Investments,Other';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS liability_categories VARCHAR(255) DEFAULT 'Mortgage,Car Loan,Credit Card,Student Loan,Other';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS income_categories VARCHAR(255) DEFAULT 'Salary,Bonus,Investment Income,Other';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS expense_categories VARCHAR(255) DEFAULT 'Housing,Transportation,Food,Healthcare,Entertainment,Other';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS person1_name VARCHAR(255) DEFAULT 'Person 1';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS person2_name VARCHAR(255) DEFAULT 'Person 2';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS projection_years INTEGER DEFAULT 30;

-- Update existing records to ensure non-null values if defaults were not applied
UPDATE user_settings SET asset_categories = 'Real Estate,Vehicles,Investments,Other' WHERE asset_categories IS NULL;
UPDATE user_settings SET liability_categories = 'Mortgage,Car Loan,Credit Card,Student Loan,Other' WHERE liability_categories IS NULL;
UPDATE user_settings SET income_categories = 'Salary,Bonus,Investment Income,Other' WHERE income_categories IS NULL;
UPDATE user_settings SET expense_categories = 'Housing,Transportation,Food,Healthcare,Entertainment,Other' WHERE expense_categories IS NULL;
UPDATE user_settings SET person1_name = 'Person 1' WHERE person1_name IS NULL;
UPDATE user_settings SET person2_name = 'Person 2' WHERE person2_name IS NULL;
UPDATE user_settings SET projection_years = 30 WHERE projection_years IS NULL;

-- Make the columns NOT NULL after setting defaults
ALTER TABLE user_settings ALTER COLUMN asset_categories SET NOT NULL;
ALTER TABLE user_settings ALTER COLUMN liability_categories SET NOT NULL;
ALTER TABLE user_settings ALTER COLUMN income_categories SET NOT NULL;
ALTER TABLE user_settings ALTER COLUMN expense_categories SET NOT NULL;
ALTER TABLE user_settings ALTER COLUMN person1_name SET NOT NULL;
ALTER TABLE user_settings ALTER COLUMN person2_name SET NOT NULL;
ALTER TABLE user_settings ALTER COLUMN projection_years SET NOT NULL;
