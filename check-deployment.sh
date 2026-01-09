#!/bin/bash

echo "=== Backend Health Check ==="
curl -s https://api.ordaxium.com/health 2>/dev/null | jq '.' || echo "Backend health check failed"

echo -e "\n=== Frontend Accessibility ==="
curl -I -s https://www.ordaxium.com 2>/dev/null | head -1 || echo "Frontend accessibility check failed"

echo -e "\n=== CORS Preflight Test ==="
curl -s -X OPTIONS https://api.ordaxium.com/users/me \
  -H "Origin: https://www.ordaxium.com" \
  -H "Access-Control-Request-Method: GET" \
  -I 2>/dev/null | grep -i "access-control" || echo "CORS preflight test failed"

echo -e "\n=== DNS Resolution ==="
nslookup www.ordaxium.com 2>/dev/null | grep -A 2 "Name:" || echo "DNS resolution check failed"

echo -e "\n=== Checking CORS Configuration ==="
echo "CORS should allow: https://www.ordaxium.com"
