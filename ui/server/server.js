import express from 'express';
import path from 'path';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 8080;
const buildDir = path.resolve('build');

const createCsp = (nonce) => [
  "default-src 'self'",
  `script-src 'self' https://static.cloudflareinsights.com https://cdn.plaid.com 'nonce-${nonce}'`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://api.modelmyretirement.com https://api.ordaxium.com https://api.plaid.com",
  "img-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'self' https://cdn.plaid.com",
].join('; ');

app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.setHeader('Content-Security-Policy', createCsp(nonce));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

app.use(express.static(buildDir, { immutable: true, maxAge: '1y' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server listening on ${PORT}`);
});
