# Brokerage Grouping Feature Design

## Current Structure
- Each Account has: `brokerage`, `broker_name`, `broker_email`, `broker_phone`
- Problem: Duplicate broker information across multiple accounts from the same brokerage

## New Structure
- Create `Brokerage` table with: `id`, `owner_id`, `name`, `broker_name`, `broker_email`, `broker_phone`
- Account table changes:
  - Add `brokerage_id` foreign key
  - Remove `brokerage`, `broker_name`, `broker_email`, `broker_phone` (or keep for backward compatibility during migration)
  - Keep `account_name`, `account_number`, `is_retirement` (account-specific fields)

## Implementation Plan

### Phase 1: Database Schema
1. Create Brokerage model
2. Create migration to:
   - Create brokerages table
   - Extract unique brokerages from existing accounts
   - Add brokerage_id to accounts
   - Link accounts to brokerages

### Phase 2: API Changes
1. Create `/brokerages/` endpoints (CRUD)
2. Update `/accounts/` endpoints to use brokerage_id
3. Maintain backward compatibility during transition

### Phase 3: UI Changes
1. Create Brokerage management page
2. Update Account creation/edit to select brokerage
3. Group accounts by brokerage in UI

## Migration Strategy
- Start with adding brokerage_id as nullable
- Populate from existing data
- Then make it required
- Finally remove old fields
