# Deployment Verification Guide

## Pre-Deployment Checklist

### 1. CORS Configuration ✅
- [x] Backend CORS regex updated to allow:
  - `http://localhost:3000` (local dev)
  - `https://www.ordaxium.com` (production)
  - `https://finmodel-frontend-service-.*\.run\.app` (old Cloud Run URL during migration)
- Files updated:
  - `api/config.py`
  - `api/Dockerfile`
  - `cloudbuild.yaml`

### 2. Environment Variables
Verify these are set in Cloud Run:
- `PUBLIC_BACKEND_URL=https://api.ordaxium.com`
- `FRONTEND_URL=https://www.ordaxium.com`
- `CORS_ORIGINS_REGEX=^(http://localhost:3000|https://www\.ordaxium\.com|https://finmodel-frontend-service-.*\.run\.app)$`

### 3. Frontend Build Configuration
- [x] `REACT_APP_API_URL=https://api.ordaxium.com` set during build
- [x] Nginx configured to proxy `/api/` to `https://api.ordaxium.com/`

## Post-Deployment Verification Steps

### Step 1: Verify Backend Service is Running

```bash
# Check backend health
curl https://api.ordaxium.com/health

# Expected: JSON response with status
```

### Step 2: Verify CORS Configuration

```bash
# Test OPTIONS preflight from new domain
curl -X OPTIONS https://api.ordaxium.com/users/me \
  -H "Origin: https://www.ordaxium.com" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Should return 200 with CORS headers:
# Access-Control-Allow-Origin: https://www.ordaxium.com
# Access-Control-Allow-Methods: *
# Access-Control-Allow-Headers: *
```

### Step 3: Verify Frontend Service

```bash
# Check if frontend is accessible via new domain
curl -I https://www.ordaxium.com

# Check if frontend is accessible via old Cloud Run URL (during migration)
curl -I https://finmodel-frontend-service-msdi7jcivq-ue.a.run.app
```

### Step 4: Test Login Flow

#### Using Browser DevTools:
1. Open `https://www.ordaxium.com` (or old Cloud Run URL)
2. Open DevTools → Network tab
3. Attempt login with valid credentials
4. Verify:
   - ✅ `OPTIONS /token` returns 200 (CORS preflight)
   - ✅ `POST /token` returns 200 with `access_token`
   - ✅ `OPTIONS /users/me` returns 200
   - ✅ `GET /users/me` returns 200 with user data
   - ✅ No CORS errors in console

#### Using curl:
```bash
# 1. Login
LOGIN_RESPONSE=$(curl -X POST https://api.ordaxium.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Origin: https://www.ordaxium.com" \
  -d "username=YOUR_EMAIL&password=YOUR_PASSWORD" \
  -v)

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

# 2. Get user info
curl -X GET https://api.ordaxium.com/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: https://www.ordaxium.com" \
  -v
```

### Step 5: Verify Load Balancer Routing

#### Check DNS Resolution:
```bash
# Check www.ordaxium.com resolves correctly
nslookup www.ordaxium.com

# Should point to Google Cloud Load Balancer IP
```

#### Check Domain Mapping:
```bash
# Verify Cloud Run domain mapping exists
gcloud run domain-mappings list \
  --region=us-east1 \
  --project=financial-model-cloud

# Should show:
# www.ordaxium.com → finmodel-frontend-service
```

### Step 6: Test API Proxy from Frontend

1. Open `https://www.ordaxium.com` in browser
2. Login successfully
3. Navigate to any page that makes API calls
4. Check Network tab - all API requests should:
   - Go through `/api/` path (proxied by Nginx)
   - Successfully reach backend
   - Return proper responses

### Step 7: Verify Google OAuth (if applicable)

1. Click "Sign in with Google" button
2. Complete OAuth flow
3. Verify redirect URI is: `https://api.ordaxium.com/auth/google/callback`
4. Verify redirect back to frontend works

## Troubleshooting

### Issue: CORS errors in browser console

**Symptoms:**
```
Access to XMLHttpRequest at 'https://api.ordaxium.com/...' from origin 'https://www.ordaxium.com' 
has been blocked by CORS policy
```

**Solutions:**
1. Verify `CORS_ORIGINS_REGEX` environment variable in Cloud Run
2. Check backend logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=finmodel-backend-service" --limit 50`
3. Verify the regex matches your frontend origin exactly

### Issue: 401 Unauthorized after login

**Symptoms:**
- Login succeeds (200 OK)
- Subsequent API calls return 401

**Solutions:**
1. Check if JWT token is being stored: `localStorage.getItem('user_token')`
2. Check if token is being sent in Authorization header
3. Verify token expiration time (should be 24 hours)
4. Check backend logs for JWT decode errors

### Issue: Frontend can't reach backend

**Symptoms:**
- Network errors
- "Connection refused" or timeouts

**Solutions:**
1. Verify backend service is running: `curl https://api.ordaxium.com/health`
2. Check Nginx proxy configuration in `ui/nginx.conf`
3. Verify `REACT_APP_API_URL` was set during frontend build
4. Check if using relative paths (`/api/`) vs absolute URLs

### Issue: Domain not resolving

**Symptoms:**
- "Site can't be reached" error
- DNS resolution failure

**Solutions:**
1. Verify DNS records are correct (see `DNS_RECORDS_NEEDED.md`)
2. Check Cloud Run domain mapping: `gcloud run domain-mappings list`
3. Allow time for DNS propagation (can take up to 48 hours)
4. Verify SSL certificate is provisioned

## Cloud Run Service URLs

**Backend:**
- Production: `https://api.ordaxium.com`
- Direct: `https://finmodel-backend-service-526419047208.us-east1.run.app`

**Frontend:**
- Production: `https://www.ordaxium.com`
- Direct: `https://finmodel-frontend-service-msdi7jcivq-ue.a.run.app`

## Quick Health Check Script

Save as `check-deployment.sh`:

```bash
#!/bin/bash

echo "=== Backend Health Check ==="
curl -s https://api.ordaxium.com/health | jq '.'

echo -e "\n=== Frontend Accessibility ==="
curl -I -s https://www.ordaxium.com | head -1

echo -e "\n=== CORS Preflight Test ==="
curl -s -X OPTIONS https://api.ordaxium.com/users/me \
  -H "Origin: https://www.ordaxium.com" \
  -H "Access-Control-Request-Method: GET" \
  -I | grep -i "access-control"

echo -e "\n=== DNS Resolution ==="
nslookup www.ordaxium.com | grep -A 2 "Name:"

echo -e "\n=== Domain Mapping ==="
gcloud run domain-mappings list --region=us-east1 --project=financial-model-cloud 2>/dev/null | grep ordaxium
```

Make executable: `chmod +x check-deployment.sh`

## Expected Test Results After Fix

✅ Login should work from both:
- `https://www.ordaxium.com`
- `https://finmodel-frontend-service-msdi7jcivq-ue.a.run.app` (temporary)

✅ All API calls should succeed with proper CORS headers

✅ No console errors related to CORS

✅ JWT tokens should be stored and sent correctly

✅ User can navigate and use the application normally
