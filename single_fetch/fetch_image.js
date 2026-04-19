// fetch_image.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const cardNames = JSON.parse(fs.readFileSync(path.join(__dirname, 'card_names.json'), 'utf-8'));

// Build box lookup: cardName -> { boxName, boxNum, position, edition }
function buildCardLookup() {
  const lookup = {};
  const boxes = Object.keys(cardNames).filter(k => k !== 'all_total');
  
  boxes.forEach((boxName, boxIdx) => {
    const boxNum = String(boxIdx + 1).padStart(2, '0');
    const box = cardNames[boxName];
    const hasRemoved = !!box.Removed;

    const allSections = Object.entries(box).filter(([k]) => k !== 'Card Count');
    let position = 1;

    for (const [, cards] of allSections) {
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        const edition = !hasRemoved ? '10' : '11'; // will be overridden by cards.json later
        lookup[card.name] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition };
        
        // Also add group sub-cards
        if (card.group) {
          for (const sub of card.group) {
            position++;
            lookup[sub] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition };
          }
        }
        position++;
      }
    }
  });

  return lookup;
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  const cardName = process.argv[2];
  if (!cardName) {
    console.error('Usage: node fetch_image.js "Card Name"');
    process.exit(1);
  }

  const lookup = buildCardLookup();
  const info = lookup[cardName];
  if (!info) {
    console.error(`[ERROR] "${cardName}" not found in card_names.json`);
    process.exit(1);
  }

  // Build ID and filename
  const { boxName, boxNum, position, edition } = info;
  const id = `${boxNum}${edition}${position}`;
  const safeName = cardName.replace(/ /g, '_');
  const filename = `${safeName}${id}.jpg`;

  // Ensure output directory exists
  const outDir = path.join(__dirname, 'images', boxName);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const destPath = path.join(outDir, filename);
  if (fs.existsSync(destPath)) {
    console.log(`[DEBUG] Already exists: ${destPath}`);
    process.exit(0);
  }

  // Fetch the media page to get the direct image URL
  const mediaUrl = `https://wiki.dominionstrategy.com/index.php/${safeName}`;
  console.log(`[DEBUG] Fetching image for "${cardName}" (ID: ${id})`);

  const directUrl = await page.evaluate(() => {
  const img = document.querySelector('.fullImageLink img, #file img');
  return img ? img.src : null;
});

if (!directUrl) {
  console.error(`[ERROR] Could not find image URL on media page`);
  await browser.close();
  process.exit(1);
}

console.log(`[DEBUG] Found image URL: ${directUrl}`);
await downloadImage(directUrl, destPath);
console.log(`[DEBUG] Saved to ${destPath}`);
}

main();
