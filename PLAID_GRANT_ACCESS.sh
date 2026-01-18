#!/bin/bash
# Grant Cloud Run service account access to Plaid secrets
# Run this script after creating the secrets

PROJECT_ID="financial-model-cloud"
SERVICE_ACCOUNT="app-docs-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Granting access to Plaid secrets for service account: ${SERVICE_ACCOUNT}"

# Grant access to _PLAID_SECRET
echo "Granting access to _PLAID_SECRET..."
gcloud secrets add-iam-policy-binding _PLAID_SECRET \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="${PROJECT_ID}"

# Grant access to _PLAID_ENCRYPTION_KEY
echo "Granting access to _PLAID_ENCRYPTION_KEY..."
gcloud secrets add-iam-policy-binding _PLAID_ENCRYPTION_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="${PROJECT_ID}"

# Grant access to _PLAID_CLIENT_ID
echo "Granting access to _PLAID_CLIENT_ID..."
gcloud secrets add-iam-policy-binding _PLAID_CLIENT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="${PROJECT_ID}"

echo ""
echo "✅ All Plaid secrets have been granted access!"
echo ""
echo "Next steps:"
echo "1. Deploy using Cloud Build"
echo "2. Test the connection in Settings > Accounts"
echo "3. Use Plaid Sandbox credentials: user_good / pass_good"
