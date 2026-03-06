import fs from 'fs';
import ssri from 'ssri';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, 'build');
const htmlPath = join(buildDir, 'index.html');

console.log(`Checking for index.html at: ${htmlPath}`);

if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // This regex targets the script and link tags Vite generates
  const assetRegex = /(<(script|link)[^>]+(?:src|href)="\/assets\/([^"]+)"[^>]*>)/g;
  
  let count = 0;
  html = html.replace(assetRegex, (match, tag, type, filename) => {
    const filePath = join(buildDir, 'assets', filename);
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      const integrity = ssri.fromData(fileBuffer, { algorithms: ['sha384'] }).toString();
      count++;
      return tag.replace('>', ` integrity="${integrity}" crossorigin="anonymous">`);
    }
    return match;
  });

  fs.writeFileSync(htmlPath, html);
  console.log(`✅ Successfully injected ${count} SRI hashes into index.html`);
} else {
  console.error('❌ Error: index.html not found! Check your build directory path.');
  process.exit(1);
}
