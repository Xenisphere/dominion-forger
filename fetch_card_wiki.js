// fetch_card_wiki.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const cardsFilePath = path.join(__dirname, 'cards.json');
const rawDir = path.join(__dirname, 'raw');

function loadCards() {
  if (fs.existsSync(cardsFilePath)) {
    const data = fs.readFileSync(cardsFilePath, 'utf-8');
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[ERROR] Failed to parse cards.json, starting fresh.');
      return [];
    }
  }
  return [];
}



function saveCards(cards) {
  fs.writeFileSync(cardsFilePath, JSON.stringify(cards, null, 2), 'utf-8');
  console.log(`[DEBUG] Saved ${cards.length} cards to cards.json`);
}

function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, ' ')                          // remove anything in <>
    .replace(/{{[^}]+}}/g, ' ')                        // remove {{ }} templates
    .replace(/&nbsp;/g, ' ')                           // &nbsp; → space
    .replace(/&[a-z]+;/gi, ' ')                        // remove other HTML entities
    .replace(/'{2,}/g, '')                             // remove '' or ''' wiki markup
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')   // [[link|text]] → text
    .split(/\s+/)                                      // split into words
    .map(word => {
      word = word.replace(/^[^a-zA-Z0-9;:]+|[^a-zA-Z0-9;:]+$/g, '');
      word = word.replace(/[^a-zA-Z0-9;:\s]/g, '');
      if (!/[aeiouAEIOU]/.test(word) && !/^\d+$/.test(word)) return '';
      if (word.length === 1 && !['a', 'i', 'A', 'I'].test(word)) return '';
      return word;
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([;:])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchCard(cardName) {
  console.log(`[DEBUG] Searching for "${cardName}"`);

  let data;

  const localPath = path.join(rawDir, `${cardName}.json`);
  if (fs.existsSync(localPath)) {
    console.log(`[DEBUG] Using local cache for "${cardName}"`);
    data = fs.readFileSync(localPath, 'utf-8');
  } else {
    console.log(`[DEBUG] Launching browser to fetch "${cardName}"`);
    const url = `https://wiki.dominionstrategy.com/api.php?action=parse&page=${encodeURIComponent(cardName)}&prop=wikitext&format=json`;

   const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // Log what the page shows while waiting
  console.log('[DEBUG] Page preview:', await page.evaluate(() => document.body.innerText.slice(0, 100)));

  await page.waitForFunction(
    () => document.body.innerText.trim().startsWith('{'),
    { timeout: 60000 }  // increased to 60s
  );

  data = await page.evaluate(() => document.body.innerText);
} finally {
  await browser.close();
}

    if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir);
    fs.writeFileSync(localPath, data, 'utf-8');
    console.log(`[DEBUG] Cached response to raw/${cardName}.json`);
  }

  try {
    const json = JSON.parse(data);
    if (!json.parse || !json.parse.wikitext || !json.parse.wikitext['*']) {
      console.error('[ERROR] Card page not found or invalid format');
      return null;
    }

    const wikitext = json.parse.wikitext['*'];

    const kingdomMatch = wikitext.match(/\|\s*set\s*=\s*(.+)/i);
    const costMatch = wikitext.match(/\|\s*cost\s*=\s*(.+)/i);
    const typesMatch = wikitext.match(/\|\s*types\s*=\s*(.+)/i);
    const textMatch = wikitext.match(/\|\s*text\s*=\s*([\s\S]+?)(?=\n\s*[|}])/i);

    const cardData = {
      name: cardName,
      kingdom: kingdomMatch ? kingdomMatch[1].trim() : 'Unknown',
      cost: costMatch ? costMatch[1].trim() : 'Unknown',
      types: typesMatch ? typesMatch[1].split(',').map(t => t.trim()) : [],
      text: textMatch ? cleanText(textMatch[1].trim()) : ''
    };

    console.log('[DEBUG] Parsed card:', cardData);
    return cardData;
  } catch (err) {
    console.error('[ERROR] Failed to parse JSON:', err);
    console.error('[DEBUG] Response preview:', data.slice(0, 200));
    return null;
  }
}

async function main() {
  const cardName = process.argv[2];
  if (!cardName) {
    console.error('Usage: node fetch_card_wiki.js "Card Name"');
    process.exit(1);
  }

  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir);

  const card = await fetchCard(cardName);
  if (!card) return;

  const cards = loadCards();
  if (cards.some(c => c.name === card.name)) {
    console.log(`[DEBUG] Card "${card.name}" already exists in cards.json`);
    return;
  }

  cards.push(card);
  saveCards(cards);
}

main();
