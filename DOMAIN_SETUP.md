# Domain Configuration for ordaxium.com

This document outlines the steps to configure `ordaxium.com` to point to your Cloud Run services.

## Prerequisites
- Domain `ordaxium.com` registered with a DNS provider
- Access to DNS management for the domain
- GCP project: `financial-model-cloud`

## Steps

### 1. Create Domain Mapping in Cloud Run

Run this command to create a domain mapping for the frontend service:

```bash
gcloud run domain-mappings create \
  --service finmodel-frontend-service \
  --domain ordaxium.com \
  --region us-east1 \
  --project financial-model-cloud
```

Or for the backend (if you want a subdomain like `api.ordaxium.com`):

```bash
gcloud run domain-mappings create \
  --service finmodel-backend-service \
  --domain api.ordaxium.com \
  --region us-east1 \
  --project financial-model-cloud
```

### 2. Get DNS Records

After creating the domain mapping, GCP will provide DNS records. Get them with:

```bash
gcloud run domain-mappings describe ordaxium.com \
  --region us-east1 \
  --project financial-model-cloud
```

Or check in the GCP Console: Cloud Run > Domain Mappings

### 3. Configure DNS

Add the provided DNS records to your domain's DNS provider:

- **Type**: A (or AAAA for IPv6)
- **Name**: @ (or leave blank for root domain)
- **Value**: The IP address(es) provided by GCP
- **TTL**: Use default (usually 3600)

**Alternative**: If GCP provides CNAME records, use those instead:
- **Type**: CNAME
- **Name**: @ (or www for www.ordaxium.com)
- **Value**: The CNAME target provided by GCP

### 4. Wait for DNS Propagation

DNS changes can take 24-48 hours to propagate, but usually take effect within minutes to a few hours.

Verify DNS propagation:
```bash
dig ordaxium.com
# or
nslookup ordaxium.com
```

### 5. SSL Certificate

GCP automatically provisions and manages SSL certificates for Cloud Run domain mappings. This typically happens automatically within a few hours of DNS propagation.

Check certificate status:
```bash
gcloud run domain-mappings describe ordaxium.com \
  --region us-east1 \
  --project financial-model-cloud
```

### 6. Update Application Configuration (if needed)

If your frontend needs to know the custom domain for API calls:

Update `ui/src/services/api.service.js` or set environment variable:
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'https://api.ordaxium.com';
```

For production builds, set in Cloud Build or deployment config:
```yaml
env:
  - 'REACT_APP_API_URL=https://api.ordaxium.com'
```

## Optional: Subdomains

If you want separate subdomains:
- `www.ordaxium.com` → frontend
- `api.ordaxium.com` → backend
- `app.ordaxium.com` → frontend (alternative)

Create separate domain mappings for each.

## Troubleshooting

1. **Domain mapping not working**:
   - Verify DNS records are correct
   - Check DNS propagation: `dig ordaxium.com`
   - Wait 24-48 hours for full propagation

2. **SSL certificate not provisioned**:
   - Ensure DNS records are correct
   - Wait a few hours after DNS propagation
   - Check Cloud Run domain mapping status in console

3. **CORS issues**:
   - Update CORS settings in `api/main.py` to include `https://ordaxium.com`

## Current Status

- [ ] Domain mapping created for frontend
- [ ] Domain mapping created for backend (if using subdomain)
- [ ] DNS records added to domain provider
- [ ] DNS propagated
- [ ] SSL certificate provisioned
- [ ] Application tested on custom domain

