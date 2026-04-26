// fetch_all_images.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const cardNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'storage/card_names.json'), 'utf-8'));

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
        console.log(`${boxName}`);
        lookup[card.name] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition: !hasRemoved ? '10' : '11' };
        if (card.group && Array.isArray(card.group)) {
          for (const sub of card.group) {
            position++;
            lookup[sub] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition: !hasRemoved ? '10' : '11' };
          }
        }
        if (card.paired_with) {
          position++;
          lookup[card.paired_with] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition: !hasRemoved ? '10' : '11' };
        }
        position++;
      }
    }
  });
  return lookup;
}

function buildEditionLookup() {
  const editionLookup = {};
  const parsedTextDir = path.join(__dirname, '..', 'parsed_text');
  for (const file of fs.readdirSync(parsedTextDir)) {
    if (!file.endsWith('.json')) continue;
    const cards = JSON.parse(fs.readFileSync(path.join(parsedTextDir, file), 'utf-8'));
    for (const card of cards) {
      if (card.id) editionLookup[card.name] = card.id;
    }
  }
  return editionLookup;
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

async function fetchImage(cardName, info, editionLookup) {
  const { boxName, boxNum, position, edition } = info;
  const safeName = cardName.replace(/ /g, '_');
  const filename = `${safeName}.jpg`;

  const outDir = path.join(__dirname, '..', 'images', boxName);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const destPath = path.join(outDir, filename);
  if (fs.existsSync(destPath)) {
    //console.log(`[SKIP] ${cardName}`);
    return true;
  }

  const mediaUrl = `https://wiki.dominionstrategy.com/index.php/File:${safeName}.jpg`;
  const html = await fetchHtml(mediaUrl);
  const match = html.match(/og:image" content="([^"]+\.jpg)"/) ||
                html.match(/href="(\/images\/[^"]+\.jpg)"/);
  if (!match) return false;

  const directUrl = match[1].startsWith('http')
    ? match[1].replace('http://', 'https://')
    : `https://wiki.dominionstrategy.com${match[1]}`;
  await downloadImage(directUrl, destPath);
  //console.log(`[DONE] ${cardName} → images/${boxName}/${filename}`);
  return true;
}

async function main() {
  const lookup = buildCardLookup();
  const editionLookup = buildEditionLookup();
  const failed = [];

  for (const [cardName, info] of Object.entries(lookup)) {
    try {
      const success = await fetchImage(cardName, info, editionLookup);
      if (!success) {
        const id = editionLookup[cardName] || `${boxNum}${position}${total}`;
        console.error(`[FAIL] ${cardName} (${id}) — could not find image URL`);
        failed.push(`${cardName} (${id})`);
      }
    } catch (err) {
      const id = editionLookup[cardName] || `${info.boxNum}10${info.position}`;
      console.error(`[FAIL] ${cardName} (${id}) — ${err.message}`);
      failed.push(`${cardName} (${id})`);
    }
  }

  if (failed.length > 0) {
    console.log(`\nFailed cards (${failed.length}):`);
    for (const name of failed) console.log(`  - ${name}`);
  } else {
    console.log('\nAll images fetched successfully!');
  }
}

main();
