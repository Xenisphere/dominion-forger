// fetch_image.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const puppeteer = require('puppeteer');

const cardNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'card_names.json'), 'utf-8'));

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
        const edition = !hasRemoved ? '10' : '11';
        lookup[card.name] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition };
        
        if (card.group) {
          for (const sub of card.group) {
            position++;
            lookup[sub] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition };
          }
        }
        if (card.paired_with) {
          position++;
          lookup[card.paired_with] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition };
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

const https = require('https');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      }
    };
    https.get(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
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

  const { boxName, boxNum, position, edition } = info;
  const id = `${boxNum}${edition}${position}`;
  const safeName = cardName.replace(/ /g, '_');
  const filename = `${safeName}${id}.jpg`;

  const outDir = path.join(__dirname, '..', 'images', boxName);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const destPath = path.join(outDir, filename);
  if (fs.existsSync(destPath)) {
    console.log(`[DEBUG] Already exists: ${destPath}`);
    process.exit(0);
  }

  const mediaUrl = `https://wiki.dominionstrategy.com/index.php/File:${safeName}.jpg`;
  console.log(`[DEBUG] Fetching media page for "${cardName}" (ID: ${id})`);
  
  const html = await fetchHtml(mediaUrl);
  const match = html.match(/href="(\/images\/[^"]+\.jpg)"/);
  if (!match) {
    console.error(`[ERROR] Could not find image URL in page`);
    process.exit(1);
  }
  
  const directUrl = `https://wiki.dominionstrategy.com${match[1]}`;
  console.log(`[DEBUG] Found image URL: ${directUrl}`);
  await downloadImage(directUrl, destPath);
  console.log(`[DEBUG] Saved to images/${boxName}/${filename}`);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(mediaUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const { directUrl, htmlSnippet } = await page.evaluate(() => {
      const img = document.querySelector('.fullImageLink img, #file img');
      return {
        directUrl: img ? img.src : null,
        htmlSnippet: document.body.innerHTML.slice(0, 1000)
      };
    });

console.log('[DEBUG] HTML snippet:', htmlSnippet);

    if (!directUrl) {
      console.error(`[ERROR] Could not find image URL on media page`);
      process.exit(1);
    }

    console.log(`[DEBUG] Found image URL: ${directUrl}`);
    await downloadImage(directUrl, destPath);
    console.log(`[DEBUG] Saved to images/${boxName}/${filename}`);
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
  } finally {
    await browser.close();
  }
}

main();
