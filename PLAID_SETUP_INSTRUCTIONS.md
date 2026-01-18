# Plaid Setup Instructions for Google Cloud

## Overview

This guide explains how to set up Plaid integration in Google Cloud using Secrets Manager and environment variables.

## Secrets Manager Setup

You need to create the following secrets in Google Cloud Secrets Manager:

### 1. Create Secrets

```bash
# Navigate to your project
gcloud config set project financial-model-cloud

# Create PLAID_SECRET secret
echo -n "your_plaid_secret_key" | gcloud secrets create _PLAID_SECRET \
  --data-file=- \
  --replication-policy="automatic"

# Create PLAID_ENCRYPTION_KEY secret
# First generate a key:
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Then create the secret:
echo -n "your_generated_encryption_key" | gcloud secrets create _PLAID_ENCRYPTION_KEY \
  --data-file=- \
  --replication-policy="automatic"

# Create PLAID_CLIENT_ID secret (can also be env var, but secrets are more secure)
echo -n "your_plaid_client_id" | gcloud secrets create _PLAID_CLIENT_ID \
  --data-file=- \
  --replication-policy="automatic"
```

### 2. Grant Cloud Run Access

Grant the Cloud Run service account access to read these secrets:

```bash
# Get your service account email
SERVICE_ACCOUNT="app-docs-sa@financial-model-cloud.iam.gserviceaccount.com"

# Grant access to secrets
gcloud secrets add-iam-policy-binding _PLAID_SECRET \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding _PLAID_ENCRYPTION_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding _PLAID_CLIENT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Update cloudbuild.yaml

The `cloudbuild.yaml` has been updated to:
- Use `--update-secrets` for `_PLAID_SECRET` and `_PLAID_ENCRYPTION_KEY`
- Use `--set-env-vars` for `PLAID_CLIENT_ID` and `PLAID_ENV`
- Include secrets in `availableSecrets` section

**Note:** The current `cloudbuild.yaml` uses `${_PLAID_CLIENT_ID}` in `--set-env-vars`, but this won't work directly. You have two options:

**Option A: Use Secret (Recommended)**
```yaml
--update-secrets=...,PLAID_CLIENT_ID=_PLAID_CLIENT_ID:1 \
```

**Option B: Use Environment Variable (Less Secure)**
```yaml
--set-env-vars='...,PLAID_CLIENT_ID=your_client_id_here,PLAID_ENV=sandbox' \
```

### 4. Environment Variables

Set `PLAID_ENV` in your Cloud Build environment or as a substitution variable:

```bash
# Option 1: Set as substitution variable in Cloud Build
gcloud builds submit --substitutions=_PLAID_ENV=sandbox

# Option 2: Set in cloudbuild.yaml directly (less flexible)
# Change: PLAID_ENV=${PLAID_ENV:-sandbox}
# To: PLAID_ENV=sandbox
```

## Configuration Summary

| Variable | Type | Location | Notes |
|----------|------|----------|-------|
| `PLAID_CLIENT_ID` | Secret or Env Var | Secrets Manager or Env | Can be either, but secrets are more secure |
| `PLAID_SECRET` | Secret | Secrets Manager | **Must be secret** - very sensitive |
| `PLAID_ENCRYPTION_KEY` | Secret | Secrets Manager | **Must be secret** - used to encrypt access tokens |
| `PLAID_ENV` | Environment Variable | Cloud Run Env | `sandbox`, `development`, or `production` |

## Testing

After setup:

1. **Verify secrets exist:**
   ```bash
   gcloud secrets list --filter="name:_PLAID"
   ```

2. **Test secret access:**
   ```bash
   gcloud secrets versions access latest --secret="_PLAID_SECRET"
   ```

3. **Deploy and test:**
   - Deploy using Cloud Build
   - Check Cloud Run logs for Plaid initialization
   - Visit Settings > Accounts page
   - Click "Connect Bank Account" button
   - Use Plaid Sandbox credentials: `user_good` / `pass_good`

## Troubleshooting

### Error: "Plaid integration is not configured"
- Check that all secrets are created and accessible
- Verify service account has `secretAccessor` role
- Check Cloud Run logs for initialization errors

### Error: "Failed to initialize Plaid"
- Verify `PLAID_CLIENT_ID` and `PLAID_SECRET` are correct
- Check `PLAID_ENV` is set correctly (`sandbox`, `development`, or `production`)
- Ensure secrets are at version 1 (or update version numbers in cloudbuild.yaml)

### Secret Version Mismatch
If you create new versions of secrets, update the version numbers in `cloudbuild.yaml`:
```yaml
--update-secrets=...,PLAID_SECRET=_PLAID_SECRET:2,PLAID_ENCRYPTION_KEY=_PLAID_ENCRYPTION_KEY:2
```

## Next Steps

1. Create secrets in Secrets Manager
2. Grant service account access
3. Update `cloudbuild.yaml` if needed (for PLAID_CLIENT_ID handling)
4. Deploy
5. Test connection in Settings > Accounts
