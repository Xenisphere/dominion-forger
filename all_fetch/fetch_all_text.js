// fetch_all_raw.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const rawDir = path.join(__dirname, 'raw');
const cardNamesPath = path.join(__dirname, 'card_names.json');

async function fetchRaw(cardName, page) {
  const localPath = path.join(rawDir, `${cardName}.json`);
  if (fs.existsSync(localPath)) {
    console.log(`[SKIP] Already cached: ${cardName}`);
    return;
  }

  const url = `https://wiki.dominionstrategy.com/api.php?action=parse&page=${encodeURIComponent(cardName.replace(/_/g, ' '))}&prop=wikitext&format=json`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 100000 });
    await page.waitForFunction(
      () => document.body.innerText.trim().startsWith('{'),
      { timeout: 100000 }
    );
    const data = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(localPath, data, 'utf-8');
    console.log(`[SAVED] ${cardName}`);
  } catch (err) {
    console.error(`[ERROR] Failed to fetch ${cardName}:`, err.message);
  }
}

async function main() {
  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir);

  const cardNames = JSON.parse(fs.readFileSync(cardNamesPath, 'utf-8'));

  // Group cards by first letter
  const batches = {};
  for (const name of cardNames) {
    const letter = name[0].toLowerCase();
    if (!batches[letter]) batches[letter] = [];
    batches[letter].push(name);
  }

  const letters = Object.keys(batches).sort();
  console.log(`[INFO] ${cardNames.length} cards across ${letters.length} batches`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (const letter of letters) {
      const batch = batches[letter];
      console.log(`\n[BATCH] Letter "${letter.toUpperCase()}" — ${batch.length} cards`);

      for (const cardName of batch) {
        await fetchRaw(cardName, page);
        // Small delay between requests to avoid triggering rate limits
        await new Promise(r => setTimeout(r, 1500));
      }

      console.log(`[BATCH DONE] "${letter.toUpperCase()}"`);
    }
  } finally {
    await browser.close();
  }

  console.log('\n[DONE] All cards fetched.');
}

main();
