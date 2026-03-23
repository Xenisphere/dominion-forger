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
    .replace(/{{VP\|(\d+)[^}]*}}/gi, '{$1}')           // {{VP|2}} → {2}
    .replace(/{{Costplus\|(\d+)}}/gi, '($1)')           // {{Costplus|1}} → (1)
    .replace(/{{Cost\|(\d+)D[^}]*}}/gi, '<$1>')         // {{Cost|4D}} → <4> debt
    .replace(/{{Cost\|(\d+)P[^}]*}}/gi, '[$1]')         // {{Cost|2P}} → [2] potion
    .replace(/{{Cost\|(\d+)[^}]*}}/gi, '($1)')          // {{Cost|5}} → (5) coins
    .replace(/{{Debt\|(\d+)[^}]*}}/gi, '<$1>')          // {{Debt|4}} → <4>
    .replace(/{{Potion[^}]*}}/gi, '[1]')                // {{Potion}} → [1]
    .replace(/{{[^}]+}}/g, ' ')                         // generic - after specific ones
    .split(/\s+/)
    .map(word => {
      word = word.replace(/^[^a-zA-Z0-9;:.,!?]+|[^a-zA-Z0-9;:.,!?]+$/g, '');
      word = word.replace(/[^a-zA-Z0-9;:.,!?\s]/g, '');
      if (word.startsWith('+')) return word;
      if (!/[aeiouAEIOU]/.test(word) && !/^\d+$/.test(word)) return '';
      if (word.length === 1 && !/^[aiAI]$/.test(word)) return '';
      return word;
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([;:.,!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchCard(cardName) {
  console.log(`[DEBUG] Searching for "${cardName}"`);
  cardName = cardName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  let data;

  const localPath = path.join(rawDir, `${cardName}.json`);
  if (fs.existsSync(localPath)) {
    console.log(`[DEBUG] Using local cache for "${cardName}"`);
    data = fs.readFileSync(localPath, 'utf-8');
  } else {
    console.log(`[DEBUG] Launching browser to fetch "${cardName}"`);
const url = `https://wiki.dominionstrategy.com/api.php?action=parse&page=${encodeURIComponent(cardName.replace(/_/g, ' '))}&prop=wikitext&format=json`;
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 200000 });
      console.log('[DEBUG] Page preview:', await page.evaluate(() => document.body.innerText.slice(0, 100)));
      await page.waitForFunction(
        () => document.body.innerText.trim().startsWith('{'),
        { timeout: 200000 }
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

    // Grab all text fields: text, text2, text3, etc.
    const textFields = [];
    const baseText = wikitext.match(/\|\s*text\s*=\s*([\s\S]+?)(?=\n\s*[|}])/i);
    if (baseText) textFields.push(baseText[1]);
    let i = 2;
    while (true) {
      const match = wikitext.match(new RegExp(`\\|\\s*text${i}\\s*=\\s*([\\s\\S]+?)(?=\\n\\s*[|}])`, 'i'));
      if (!match) break;
      textFields.push(match[1]);
      i++;
    }
    const rawText = textFields.join(' ').trim();

    console.log('[DEBUG] Raw text:', rawText);
    const cleanedText = rawText ? cleanText(rawText) : '';
    console.log('[DEBUG] Cleaned text:', cleanedText);
    
    const cardData = {
      name: cardName,
      kingdom: kingdomMatch ? kingdomMatch[1].trim() : 'Unknown',
      cost: costMatch ? costMatch[1].trim() : 'Unknown',
      types: typesMatch ? typesMatch[1].split(',').map(t => t.trim()) : [],
      text: cleanedText
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
