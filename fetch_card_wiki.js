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
    .replace(/{{VP\|(\d+)[^}]*}}/gi, '{$1}')
    .replace(/{{Costplus\|(\d+)[^}]*}}/gi, '+($1)')
    .replace(/{{Cost\|(\d+)D[^}]*}}/gi, '<$1>')
    .replace(/{{Cost\|(\d+)P[^}]*}}/gi, '[$1]')
    .replace(/{{Cost\|(\d+)[^}]*}}/gi, '($1)')
    .replace(/{{Debt\|(\d+)[^}]*}}/gi, '<$1>')
    .replace(/{{Potion[^}]*}}/gi, '[1]')
    .replace(/{{[^}]+}}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&nbsp;?/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/'{2,}/g, '')
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
    .replace(/<\/p\s*>/gi, ' ')                        // </p> → space
    .replace(/<p\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')                          // remove remaining tags
    .split(/\s+/)
    .map(word => {
      if (word === '|') return word;
      if (/^\d+$/.test(word)) return word;  // preserve standalone numbers
      word = word.replace(/^[^a-zA-Z0-9;:.,!?()\[\]{}<>+]+|[^a-zA-Z0-9;:.,!?()\[\]{}<>]+$/g, '');
      word = word.replace(/[^a-zA-Z0-9;:.,!?()\[\]{}<>+\s]/g, '');
      if (/^[+<(\[{]/.test(word)) return word;
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

  let wikitext;
  const localPath = path.join(rawDir, `${cardName}.json`);

  if (fs.existsSync(localPath)) {
    console.log(`[DEBUG] Using local cache for "${cardName}"`);
    const fileData = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    wikitext = fileData.infobox;
  } else {
    console.log(`[DEBUG] Launching browser to fetch "${cardName}"`);
    const url = `https://wiki.dominionstrategy.com/api.php?action=parse&page=${encodeURIComponent(cardName)}&prop=wikitext&format=json`;

    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 100000 });
      console.log('[DEBUG] Page preview:', await page.evaluate(() => document.body.innerText.slice(0, 100)));
      await page.waitForFunction(
        () => document.body.innerText.trim().startsWith('{'),
        { timeout: 100000 }
      );

      let rawData = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          rawData = await page.evaluate(() => document.body.innerText);
          break;
        } catch (err) {
          console.log(`[DEBUG] Extraction attempt ${attempt} failed, retrying...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (!rawData) throw new Error('Failed to extract page data after 3 attempts');

      const parsed = JSON.parse(rawData);
      const wikiRaw = parsed?.parse?.wikitext?.['*'] || '';
      const infoboxMatch = wikiRaw.match(/{{Infobox Card[\s\S]+?(?=\n}})\n}}/i);
      wikitext = infoboxMatch ? infoboxMatch[0] : wikiRaw;

      if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir);
      fs.writeFileSync(localPath, JSON.stringify({ infobox: wikitext }, null, 2), 'utf-8');
      console.log(`[DEBUG] Cached response to raw/${cardName}.json`);
    } finally {
      await browser.close();
    }
  }

  try {
    if (!wikitext) {
      console.error('[ERROR] Card page not found or invalid format');
      return null;
    }

    const kingdomMatch = wikitext.match(/\|\s*set\s*=\s*(.+)/i);
    const costMatch = wikitext.match(/\|\s*cost\s*=\s*(.+)/i);
    const cost2Match = wikitext.match(/\|\s*cost2\s*=\s*(.+)/i);
    const cost3Match = wikitext.match(/\|\s*cost3\s*=\s*(.+)/i);
    const costExtraMatch = wikitext.match(/\|\s*cost_extra\s*=\s*(.+)/i);
    const costExtra = costExtraMatch ? costExtraMatch[1].trim() : '';
    const typesMatch = wikitext.match(/\|\s*types\s*=\s*(.+)/i);
    const purposeMatch = wikitext.match(/\|\s*purpose\s*=\s*(.+)/i);
    const purpose = purposeMatch ? purposeMatch[1].trim() : 'Unknown';
    const supply = purpose.toLowerCase().includes('non-supply') ? 'Non-Supply' :
                   purpose.toLowerCase().includes('kingdom') ? 'Kingdom Pile' :
                   purpose.toLowerCase().includes('base') ? 'Base' : purpose;

    function formatCost(raw, extra, isDebt) {
      if (!raw) return 'Unknown';
      raw = raw.trim();
      const plus = extra === '+' ? '+' : '';
      const debtMatch = raw.match(/(\d+)D/i);
      const potionMatch = raw.match(/P/i);
      const coinMatch = raw.match(/(\d+)/);
      if (debtMatch || isDebt) return `<${debtMatch ? debtMatch[1] : coinMatch[1]}>${plus}`;
      if (potionMatch) return `[1]${plus}`;
      if (coinMatch) return `(${coinMatch[1]})${plus}`;
      return raw;
    }

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
    const rawText = textFields.join(' | ').trim();
    console.log('[DEBUG] Raw text:', rawText);
    const cleanedText = rawText ? cleanText(rawText) : '';
    console.log('[DEBUG] Cleaned text:', cleanedText);

    const cardData = {
      name: cardName,
      supply: supply,
      kingdom: kingdomMatch ? kingdomMatch[1].trim() : 'Unknown',
      cost: costMatch && cost2Match
        ? formatCost(costMatch[1], costExtra, false) + formatCost(cost2Match[1], costExtra, true)
        : cost3Match
        ? formatCost(costMatch ? costMatch[1] : null, costExtra, false) + '[1]'
        : formatCost(costMatch ? costMatch[1] : cost2Match ? cost2Match[1] : null, costExtra, !!cost2Match && !costMatch),
      types: typesMatch ? typesMatch[1].split(',').map(t => t.trim()) : [],
      text: cleanedText
    };

    console.log('[DEBUG] Parsed card:', cardData);
    return cardData;
  } catch (err) {
    console.error('[ERROR] Failed to parse JSON:', err);
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
