#!/bin/bash
# Quick script to check Plaid secret configuration

PROJECT="financial-model-cloud"
SERVICE_ACCOUNT="app-docs-sa@${PROJECT}.iam.gserviceaccount.com"

echo "=== Checking Plaid Secrets ==="
gcloud secrets list --filter="name:_PLAID" --project="${PROJECT}"

echo ""
echo "=== Checking Service Account Access ==="
for secret in _PLAID_SECRET _PLAID_ENCRYPTION_KEY _PLAID_CLIENT_ID; do
  echo -n "  ${secret}: "
  if gcloud secrets get-iam-policy "${secret}" --project="${PROJECT}" 2>/dev/null | grep -q "${SERVICE_ACCOUNT}"; then
    echo "✅ Has access"
  else
    echo "❌ Missing access - run: gcloud secrets add-iam-policy-binding ${secret} --member=serviceAccount:${SERVICE_ACCOUNT} --role=roles/secretmanager.secretAccessor --project=${PROJECT}"
  fi
done

echo ""
echo "=== Checking Cloud Run Service Configuration ==="
echo "Run this to see environment variables:"
echo "gcloud run services describe finmodel-backend-service --region=us-east1 --project=${PROJECT} --format='value(spec.template.spec.containers[0].env)'"
