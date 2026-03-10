# Replace Document Vault with User-Defined Structured Records and Advanced Search

## Overview
Replace the current Document Vault folder/file metadata system with a new schema-driven vault built around structured records, user-defined document types, and full-text search.

This is a **destructive replacement** of the current Document Vault implementation. Backward compatibility is **not required** for existing Document Vault data. The application may use a migration that drops or replaces the old vault tables and functionality as needed.

This is **not a multi-tenant application**. There will only be a small number of admins. However, **end users must be able to create and manage their own document types**.

Admins should also be able to define **system default document types** that are automatically prepopulated for **new users**. Existing users should have a **Load Recommended Defaults** action that adds missing defaults without overwriting or deleting any document types they already created.

Reports/redaction are **out of scope for this issue** and should be handled in a follow-up phase.

## Goals
- Replace the current Document Vault data model and UI.
- Allow users to define their own document categories, types, and fields.
- Allow admins to manage system defaults that seed new users.
- Support schema-driven create/edit forms for vault entries.
- Store structured metadata alongside uploaded files.
- Support search across titles, notes, metadata values, and extracted document text.
- Provide category/type filtering and smart folder suggestions.

## Product Requirements

### 1. Replace Existing Document Vault
The old Document Vault implementation should be retired and replaced.

Notes:
- Existing document vault records do not need to be preserved.
- Existing folder/document APIs and UI may be removed or rewritten.
- A destructive schema migration is acceptable.

### 2. User-Defined Document Types
Users can create and manage their own document type definitions.

Each definition should include:
- Category
- Type name
- Active/inactive status
- Ordered list of fields
- Field metadata:
  - `id`
  - `label`
  - `type`
  - `required`
  - `placeholder`
  - `options` for select/multi-select
  - `is_sensitive`
  - `hidden` or conditional visibility settings

Supported field types:
- Text
- Number
- Date
- Select
- Multi-select
- Boolean
- Email
- Phone
- URL
- Textarea

Examples of categories:
- IDs & Vital Info
- Digital Assets
- Home & Property
- Financial
- Legal
- Health
- Contacts
- Aging
- Legacy

### 3. Admin Defaults
Admins may manage system default templates for document types.

Behavior:
- Admins can create/edit default templates.
- New users should automatically receive user-owned copies of the active system defaults.
- Existing users should have a `Load Recommended Defaults` action that adds only missing default types.
- Loading defaults must not overwrite, delete, or reset any existing user-defined or previously customized types.
- Users can start from system defaults.
- Users must be able to customize their own copies without affecting other users.
- User-owned definitions are the primary source for rendering forms.

Suggested behavior for default loading:
- System defaults should be copied into the user's own definitions, rather than referenced live.
- The copy operation should be additive and idempotent.
- If a matching default was already loaded earlier, it should not create duplicate copies.

### 4. Schema-Driven Entry Forms
The upload/create/edit experience must be schema-driven.

Requirements:
- User selects a category and type.
- UI loads the matching field definition.
- Form renders dynamically from stored schema, not hard-coded TypeScript unions.
- Validation should be driven by the stored schema and/or enforced server-side.
- All entries include standard fields:
  - Name/Title
  - Description
  - Notes
  - File upload
- Type-specific metadata is stored as flexible JSON.

### 5. Document Entry Storage
The new vault should store:
- Owner/user ID
- Category
- Type
- Structured metadata JSON
- Notes
- Uploaded file reference
- Extracted text content
- Search index/vector
- Suggested/selected folder or organizational path if retained

This should replace the current `documents`-based vault model rather than extend it.

### 6. Advanced Search
Users must be able to search across:
- Entry title/name
- Description/notes
- Metadata values
- Extracted text from uploaded files

Search UX should support:
- Global text search
- Category filter
- Type filter
- Real-time or near-real-time filtering
- Results that include both structured matches and content matches

### 7. Content Extraction Pipeline
Uploaded files should be processed for searchability.

Requirements:
- Extract text from digital PDFs using `PyMuPDF` or equivalent
- Use OCR fallback for scanned/image-based documents
- Store extracted text for search
- Index searchable text in PostgreSQL using `TSVECTOR` + `GIN`

Processing may be asynchronous if needed.

### 8. Smart Folder Suggestion
If foldering remains part of the experience, the system should suggest an appropriate destination based on the selected category/type.

Examples:
- `Health Insurance` suggests a health-related folder
- `Will` suggests a legal folder

The user should still be able to override the suggestion.

If the old folder model is removed entirely, replace this with another lightweight organizational mechanism.

## Technical Direction

### Backend
Create a new vault model, for example:

- `document_entries`
- `document_type_definitions`

Possible entry model fields:
- `id`
- `owner_id`
- `category`
- `doc_type`
- `title`
- `description`
- `notes`
- `metadata_json`
- `file_path` or storage key
- `content_text`
- `search_vector`
- timestamps

Possible definition model fields:
- `id`
- `owner_id` nullable for system defaults
- `category`
- `doc_type`
- `fields_config` JSONB
- `is_active`
- timestamps

Notes:
- User-owned definitions should be supported directly.
- System defaults can be created and maintained by admins.
- New-user setup should seed user-owned copies of active defaults.
- Existing users should be able to trigger a non-destructive sync/load of missing defaults.
- Validation should not rely on hard-coded frontend discriminated unions as the source of truth.

### Frontend
Build:
- Document type manager UI
- Schema-driven entry form
- Search/filter bar
- Entry listing/detail/edit views

Recommended approach:
- React form rendering from fetched schema definition
- Runtime validation based on schema config
- Server-side validation as final enforcement

## Out of Scope
- Redacted reports
- Printable/exportable summaries
- Legacy data migration fidelity
- Backward compatibility with old Document Vault APIs/UI

## Definition of Done
- [ ] Existing Document Vault implementation is replaced
- [ ] Destructive migration is acceptable and documented
- [ ] Users can create, edit, activate, and deactivate their own document types
- [ ] Admins can manage default templates
- [ ] New users are automatically seeded with active default document types
- [ ] Existing users can load missing defaults without overwriting existing definitions
- [ ] Upload/create/edit forms render dynamically from stored schema definitions
- [ ] Vault entries store structured metadata plus uploaded file reference
- [ ] Extracted file text is stored and searchable
- [ ] PostgreSQL full-text search is implemented with indexing
- [ ] Search supports global text, category filter, and type filter
- [ ] Smart folder suggestion works, if foldering is retained
- [ ] Reports/redaction are excluded from this phase

## Follow-Up Issue
Create a separate follow-up issue for:
- Redacted reports
- Category-specific exports
- Printable summaries
