# Plaid Troubleshooting Guide

## Issue: "Plaid integration is not configured" Message

If you see this message, it means the backend cannot read the Plaid secrets from Cloud Run.

## Step 1: Verify Secrets Exist

```bash
gcloud secrets list --filter="name:_PLAID"
```

Should show:
- `_PLAID_CLIENT_ID`
- `_PLAID_SECRET`
- `_PLAID_ENCRYPTION_KEY`

## Step 2: Verify Service Account Has Access

```bash
gcloud secrets get-iam-policy _PLAID_SECRET \
  --project=financial-model-cloud
```

Should show `app-docs-sa@financial-model-cloud.iam.gserviceaccount.com` with role `roles/secretmanager.secretAccessor`.

## Step 3: Check Cloud Run Environment Variables

The secrets are mapped to environment variables in Cloud Run. Check what's actually set:

```bash
gcloud run services describe finmodel-backend-service \
  --region=us-east1 \
  --project=financial-model-cloud \
  --format="value(spec.template.spec.containers[0].env)"
```

Look for:
- `PLAID_CLIENT_ID` (should be mapped from `_PLAID_CLIENT_ID` secret)
- `PLAID_SECRET` (should be mapped from `_PLAID_SECRET` secret)
- `PLAID_ENCRYPTION_KEY` (should be mapped from `_PLAID_ENCRYPTION_KEY` secret)
- `PLAID_ENV` (should be `sandbox`)

## Step 4: Check Backend Logs

Look for these log messages in Cloud Run logs:

**If Plaid is NOT configured:**
```
Plaid credentials not configured. Plaid features will be disabled.
```

**If Plaid initialization fails:**
```
Failed to initialize Plaid client: <error message>
```

**If Plaid IS configured:**
- No warning messages about Plaid
- `/plaid/link-token` endpoint should return a link token (not 503)

## Step 5: Verify Secret Mapping in cloudbuild.yaml

The `--update-secrets` flag maps secrets to environment variables:

```yaml
--update-secrets=PLAID_SECRET=_PLAID_SECRET:1,PLAID_ENCRYPTION_KEY=_PLAID_ENCRYPTION_KEY:1,PLAID_CLIENT_ID=_PLAID_CLIENT_ID:1
```

This creates:
- Environment variable `PLAID_SECRET` from secret `_PLAID_SECRET` version 1
- Environment variable `PLAID_ENCRYPTION_KEY` from secret `_PLAID_ENCRYPTION_KEY` version 1
- Environment variable `PLAID_CLIENT_ID` from secret `_PLAID_CLIENT_ID` version 1

## Step 6: Test the Backend Endpoint

```bash
# Get your auth token first
TOKEN="your_jwt_token"

# Test the link token endpoint
curl -X GET "https://api.ordaxium.com/plaid/link-token" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected responses:**
- **503**: Plaid not configured (secrets not readable)
- **500**: Plaid configured but link token creation failed
- **200**: Success (returns `{"link_token": "..."}`)

## Common Issues

### Issue 1: Secrets Not Accessible
**Symptom:** 503 error, "Plaid integration is not configured"

**Solution:**
1. Verify service account has `secretAccessor` role
2. Check secret version numbers match in `cloudbuild.yaml`
3. Redeploy to ensure secrets are mapped

### Issue 2: Wrong Secret Versions
**Symptom:** Secrets exist but backend can't read them

**Solution:**
- Check secret versions: `gcloud secrets versions list _PLAID_SECRET`
- Update version numbers in `cloudbuild.yaml` if needed

### Issue 3: Empty Secret Values
**Symptom:** Plaid client initializes but API calls fail

**Solution:**
- Verify secrets have actual values (not empty strings)
- Recreate secrets if needed

## Quick Fix Script

```bash
#!/bin/bash
# Verify and fix Plaid secret access

PROJECT="financial-model-cloud"
SERVICE_ACCOUNT="app-docs-sa@${PROJECT}.iam.gserviceaccount.com"

echo "Checking Plaid secrets..."
gcloud secrets list --filter="name:_PLAID" --project="${PROJECT}"

echo ""
echo "Checking service account access..."
for secret in _PLAID_SECRET _PLAID_ENCRYPTION_KEY _PLAID_CLIENT_ID; do
  echo "Checking ${secret}..."
  gcloud secrets get-iam-policy "${secret}" --project="${PROJECT}" | grep -q "${SERVICE_ACCOUNT}" && echo "  ✅ Has access" || echo "  ❌ Missing access"
done

echo ""
echo "To grant access, run:"
echo "bash PLAID_GRANT_ACCESS.sh"
```

## Next Steps After Fixing

1. Redeploy the backend service
2. Check Cloud Run logs for Plaid initialization
3. Test the `/plaid/link-token` endpoint
4. Try connecting in Settings > Accounts
