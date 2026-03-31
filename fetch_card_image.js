// fetch_card_image.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const rawDir = path.join(__dirname, 'raw');
const imagesDir = path.join(__dirname, 'images');

function getImageName(cardName) {
  cardName = cardName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const localPath = path.join(rawDir, `${cardName}.json`);
  if (!fs.existsSync(localPath)) {
    console.error(`[ERROR] No cached raw file for "${cardName}"`);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
  const infobox = data.infobox;
  if (!infobox) {
    console.error(`[ERROR] No infobox found in raw file for "${cardName}"`);
    return null;
  }
  const match = infobox.match(/\|\s*image\s*=\s*(.+)/i);
  if (!match) {
    console.error(`[ERROR] No image field found in infobox for "${cardName}"`);
    return null;
  }
  return match[1].trim();
}

function downloadImage(imageName, destPath) {
  return new Promise((resolve, reject) => {
    const url = `https://wiki.dominionstrategy.com/images/${encodeURIComponent(imageName)}`;
    console.log(`[DEBUG] Downloading from: ${url}`);

    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`[DEBUG] Redirecting to: ${res.headers.location}`);
        https.get(res.headers.location, (res2) => {
          if (res2.statusCode !== 200) {
            reject(new Error(`Failed with status ${res2.statusCode}`));
            return;
          }
          const file = fs.createWriteStream(destPath);
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
          file.on('error', reject);
        }).on('error', reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed with status ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  const cardName = process.argv[2];
  if (!cardName) {
    console.error('Usage: node fetch_card_image.js "Card Name"');
    process.exit(1);
  }

  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);

  const imageName = getImageName(cardName);
  if (!imageName) return;

  const destPath = path.join(imagesDir, imageName);
  if (fs.existsSync(destPath)) {
    console.log(`[SKIP] Image already exists: ${imageName}`);
    return;
  }

  console.log(`[DEBUG] Fetching image "${imageName}" for "${cardName}"`);
  try {
    await downloadImage(imageName, destPath);
    console.log(`[SAVED] ${imageName}`);
  } catch (err) {
    console.error(`[ERROR] Failed to download image:`, err.message);
  }
}

main();
