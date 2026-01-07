# Google Cloud DNS Setup for ordaxium.com

## Overview
Since your domain is registered in Google Cloud, you'll configure DNS through Google Cloud DNS.

## Steps

### 1. Create a Managed Zone (if you haven't already)

If you don't have a DNS managed zone yet, create one:

```bash
gcloud dns managed-zones create ordaxium-zone \
  --dns-name=ordaxium.com \
  --description="DNS zone for ordaxium.com" \
  --project=financial-model-cloud
```

This will create a zone and provide **name servers**. You'll need to update your domain registration to use these name servers.

### 2. Get Your Name Servers

```bash
gcloud dns managed-zones describe ordaxium-zone \
  --project=financial-model-cloud \
  --format="value(nameServers)"
```

Copy these name servers - you'll need them for step 3.

### 3. Update Domain Registration Name Servers

In Google Domains / Cloud Domains:
1. Go to your domain: ordaxium.com
2. Navigate to **DNS** settings
3. Update the **Name servers** to use the name servers from step 2
4. Save changes

### 4. Add DNS Records to the Managed Zone

Once the name servers are configured, add the A and AAAA records:

#### Add A Records for ordaxium.com (root domain)

```bash
gcloud dns record-sets create ordaxium.com. \
  --rrdatas=216.239.32.21,216.239.34.21,216.239.36.21,216.239.38.21 \
  --type=A \
  --ttl=3600 \
  --zone=ordaxium-zone \
  --project=financial-model-cloud
```

#### Add AAAA Records for ordaxium.com (IPv6)

```bash
gcloud dns record-sets create ordaxium.com. \
  --rrdatas=2001:4860:4802:32::15,2001:4860:4802:34::15,2001:4860:4802:36::15,2001:4860:4802:38::15 \
  --type=AAAA \
  --ttl=3600 \
  --zone=ordaxium-zone \
  --project=financial-model-cloud
```

#### Add A Records for api.ordaxium.com (subdomain)

```bash
gcloud dns record-sets create api.ordaxium.com. \
  --rrdatas=216.239.32.21,216.239.34.21,216.239.36.21,216.239.38.21 \
  --type=A \
  --ttl=3600 \
  --zone=ordaxium-zone \
  --project=financial-model-cloud
```

#### Add AAAA Records for api.ordaxium.com (IPv6)

```bash
gcloud dns record-sets create api.ordaxium.com. \
  --rrdatas=2001:4860:4802:32::15,2001:4860:4802:34::15,2001:4860:4802:36::15,2001:4860:4802:38::15 \
  --type=AAAA \
  --ttl=3600 \
  --zone=ordaxium-zone \
  --project=financial-model-cloud
```

### 5. Verify DNS Records

```bash
gcloud dns record-sets list \
  --zone=ordaxium-zone \
  --project=financial-model-cloud
```

### 6. Test DNS Propagation

After adding records, verify they're working:

```bash
dig ordaxium.com @8.8.8.8
dig api.ordaxium.com @8.8.8.8
```

Or use online tools:
- https://www.whatsmydns.net/
- https://dnschecker.org/

### 7. Wait for SSL Certificates

Google Cloud will automatically provision SSL certificates once DNS is working. Check status:

```bash
gcloud beta run domain-mappings list \
  --region us-east1 \
  --project financial-model-cloud
```

## Quick Setup Script

I can provide a script that runs all these commands if you'd like. Just let me know if you want me to create it.

## Notes

- DNS changes can take a few minutes to several hours to propagate
- SSL certificate provisioning happens automatically after DNS propagates (usually within a few hours)
- Make sure to use the exact name servers provided by the managed zone
- The trailing dot (.) in domain names is important in DNS records

