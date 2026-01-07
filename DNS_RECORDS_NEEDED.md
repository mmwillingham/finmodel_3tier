# DNS Records Required for ordaxium.com

## Summary
Two domain mappings have been created:
- **ordaxium.com** → Frontend service
- **api.ordaxium.com** → Backend service

## DNS Records to Add

Add the following DNS records to your domain registrar's DNS settings for `ordaxium.com`:

### For ordaxium.com (Frontend):

**A Records (IPv4):**
- Type: A
- Name: @ (or leave blank for root domain)
- Value: 216.239.32.21
- TTL: 3600 (or default)

- Type: A
- Name: @
- Value: 216.239.34.21
- TTL: 3600

- Type: A
- Name: @
- Value: 216.239.36.21
- TTL: 3600

- Type: A
- Name: @
- Value: 216.239.38.21
- TTL: 3600

**AAAA Records (IPv6) - Optional but recommended:**
- Type: AAAA
- Name: @
- Value: 2001:4860:4802:32::15
- TTL: 3600

- Type: AAAA
- Name: @
- Value: 2001:4860:4802:34::15
- TTL: 3600

- Type: AAAA
- Name: @
- Value: 2001:4860:4802:36::15
- TTL: 3600

- Type: AAAA
- Name: @
- Value: 2001:4860:4802:38::15
- TTL: 3600

### For api.ordaxium.com (Backend):

You'll need to get the DNS records for the backend subdomain. Run:
```bash
gcloud beta run domain-mappings list --region us-east1 --project financial-model-cloud
```

Then describe the api.ordaxium.com mapping to get its DNS records. However, since both services are in the same Cloud Run region, they likely use the same DNS records (the A and AAAA records shown above).

You'll need to add:
- Type: A
- Name: api
- Value: (same IP addresses as above)

## How to Add DNS Records

1. Log into your domain registrar (where you purchased ordaxium.com)
2. Navigate to DNS management
3. Add the A and AAAA records listed above
4. Wait for DNS propagation (can take a few minutes to 48 hours)

## Verify DNS Propagation

After adding the records, verify they're working:
```bash
dig ordaxium.com
dig api.ordaxium.com
```

Or use online tools like:
- https://www.whatsmydns.net/
- https://dnschecker.org/

## SSL Certificate

Google Cloud will automatically provision SSL certificates once DNS records are propagated. This typically happens within a few hours after DNS is correctly configured.

## Testing

Once DNS propagates and SSL certificates are provisioned:
1. Visit https://ordaxium.com - should show your frontend
2. The frontend is configured to use https://api.ordaxium.com for API calls
3. Check SSL certificate status:
   ```bash
   gcloud beta run domain-mappings list --region us-east1 --project financial-model-cloud
   ```

## Next Steps

1. ✅ Domain mappings created
2. ⏳ Add DNS records to your registrar
3. ⏳ Wait for DNS propagation
4. ⏳ Wait for SSL certificate provisioning
5. ⏳ Test the application

## Updated Configuration

The following has been updated:
- Frontend build now uses `https://api.ordaxium.com` for API calls
- CORS settings include `ordaxium.com` and `www.ordaxium.com`

