// fetch_card_wiki.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const cardsFilePath = path.join(__dirname, 'cards.json');
const rawDir = path.join(__dirname, 'raw');

const aliases = {
  'Harem': 'Farm'
};

const piles = {
  'Ruins': ['Abandoned Mine', 'Ruined Library', 'Ruined Market', 'Ruined Village', 'Survivors'],
  'Knights': ['Dame Anna', 'Dame Josephine', 'Dame Molly', 'Dame Natalie', 'Dame Sylvia', 'Sir Bailey', 'Sir Destry', 'Sir Martin', 'Sir Michael', 'Sir Vander'],
  'Shelters': ['Hovel', 'Necropolis', 'Overgrown Estate'],
  'Castles': ['Humble Castle', 'Crumbling Castle', 'Small Castle', 'Haunted Castle', 'Opulent Castle', 'Sprawling Castle', 'Grand Castle', "King's Castle"],
  'Townsfolk': ['Town Crier', 'Blacksmith', 'Miller', 'Elder'],
  'Augurs': ['Herb Gatherer', 'Acolyte', 'Sorceress', 'Sibyl'],
  'Clashes': ['Battle Plan', 'Archer', 'Warlord', 'Territory'],
  'Forts': ['Tent', 'Garrison', 'Hill Fort', 'Stronghold'],
  'Odysseys': ['Old Map', 'Voyage', 'Sunken Treasure', 'Distant Shore'],
  'Wizards': ['Student', 'Conjurer', 'Sorcerer', 'Lich'],
  'Loots': ['Amphora', 'Doubloons', 'Endless Chalice', 'Figurehead', 'Hammer', 'Insignia', 'Jewels', 'Orb', 'Prize Goat', 'Puzzle Box', 'Sextant', 'Shield', 'Spell Scroll', 'Staff', 'Sword'],
};

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
    .replace(/{{Debtplus\|(\d+)[^}]*}}/gi, '+($1)')
    .replace(/{{Cost\|(\d+)D[^}]*}}/gi, '<$1>')
    .replace(/{{Cost\|(\d+)P[^}]*}}/gi, '[$1]')
    .replace(/{{Cost\|(\d+)[^}]*}}/gi, '($1)')
    .replace(/{{Debt\|(\d+)[^}]*}}/gi, '<$1>')
    .replace(/{{Potion[^}]*}}/gi, '[1]')
    .replace(/{{Costplus}}/gi, '+(_)')
    .replace(/{{Debtplus}}/gi, '+<_>')
    .replace(/{{Cost}}/gi, '(_)')
    .replace(/{{Debt}}/gi, '<_>')
    .replace(/{{[^}]+}}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/'{2,}/g, '')
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
    .replace(/<\/p\s*>/gi, ' ')
    .replace(/<p\s*\/?>/gi, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')  // only remove tags starting with a letter
    .split(/\s+/)
    .map(word => {
      if (word === '|') return word;
      if (/^\d+$_/.test(word)) return word;
      word = word.replace(/^[^a-zA-Z0-9;:.,!?()\[\]{}<>+_]+|[^a-zA-Z0-9;:.,!?()\[\]{}<>_]+$/g, '');
      word = word.replace(/[^a-zA-Z0-9;:.,!?()\[\]{}<>+_\s]/g, '');
      if (/^[+<(\[{]/.test(word)) return word;
      if (word.includes('_')) return word;  // preserve placeholder tokens like <_>
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

async function fetchCard(cardName) {
  console.log(`[DEBUG] Searching for "${cardName}"`);
  cardName = cardName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  cardName = aliases[cardName] || cardName;

  let wikitext;
  const localPath = path.join(rawDir, `${cardName}.json`);

    let fileData = null;
    if (fs.existsSync(localPath)) {
      console.log(`[DEBUG] Using local cache for "${cardName}"`);
      fileData = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
      wikitext = fileData.infobox || fileData.list || '';
    } else {
    console.log(`[DEBUG] Launching browser to fetch "${cardName}"`);
    const url = `https://wiki.dominionstrategy.com/api.php?action=parse&page=${encodeURIComponent(cardName)}&prop=wikitext&format=json`;

    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 100000 });
      console.log('[DEBUG] Page preview:', await page.evaluate(() => document.body.innerText.slice(0, 100)));

     let rawData = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await page.waitForFunction(
              () => document.body.innerText.trim().startsWith('{'),
              { timeout: 100000 }
            );
            rawData = await page.evaluate(() => document.body.innerText);
            break;
          } catch (err) {
            console.log(`[DEBUG] Extraction attempt ${attempt} failed: ${err.message}, retrying...`);
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      if (!rawData) throw new Error('Failed to extract page data after 3 attempts');

      const parsed = JSON.parse(rawData);
      const wikiRaw = parsed?.parse?.wikitext?.['*'] || '';
      const infoboxMatch = wikiRaw.match(/{{Infobox [\s\S]+?\n}}/i);
      const listMatch = wikiRaw.match(/==\s*List of [^=]+==\s*([\s\S]+?)(?=\n==|$)/i);
      
      let saveData = {};
      
      if (infoboxMatch) saveData.infobox = infoboxMatch[0];
      
      if (listMatch) {
        const listLines = listMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('*'))  // only keep bullet lines
          .join('\n');
        const listTitle = listMatch[0].match(/==\s*List of ([^=]+)==/i)?.[1].trim();
        saveData.list = `List of ${listTitle}\n${listLines}`;
      }
      
      fs.writeFileSync(localPath, JSON.stringify(saveData, null, 2), 'utf-8');
      wikitext = saveData.infobox || saveData.list || '';
      if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir);
      console.log(`[DEBUG] Cached response to raw/${cardName}.json`);
    } finally {
      await browser.close();
    }
  }

  // Check if this is a pile/group page rather than an individual card
  const isPilePage = !wikitext.includes('{{Infobox Card') && 
                     !wikitext.includes('{{Infobox Landscape') &&
                     !wikitext.includes('{{Infobox ');
  if (isPilePage) {
    console.log(`[DEBUG] "${cardName}" appears to be a pile page — extracting card list`);
    const listText = (fileData && fileData.list) ? fileData.list : wikitext;
    const listMatch = listText.match(/List of [^\n]+\n([\s\S]+)/i);
    if (listMatch) {
      const subCards = [...listMatch[1].matchAll(/\*\s*\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]|\*\s*([^\n]+)/g)]
        .map(m => (m[1] || m[2]).trim())
        .filter(Boolean);
      console.log(`[DEBUG] Found pile cards:`, subCards);
      const results = [];
      for (const subCard of subCards) {
        const card = await fetchCard(subCard);
        if (card) results.push(card);
      }
      return results;
    }
    console.error(`[ERROR] Could not find card list on pile page for "${cardName}"`);
    return null;
  }

  try {
    if (!wikitext) {
      console.error('[ERROR] Card page not found or invalid format');
      return null;
    }

    const kingdomMatch = wikitext.match(/\|\s*set\s*=\s*(.+)/i);
    const editionMatch = wikitext.match(/\|\s*edition\s*=\s*(.+)/i);
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
                   purpose.toLowerCase().includes('mixed') ? 'Mixed Pile' :
                   purpose.toLowerCase().includes('base') ? 'Base' : purpose;

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
      set: kingdomMatch ? kingdomMatch[1].trim() : 'Unknown',
      edition: editionMatch ? editionMatch[1].trim() : 'Unknown',
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

  const result = await fetchCard(cardName);
  if (!result) return;

  const newCards = Array.isArray(result) ? result : [result];
  const cards = loadCards();

  for (const card of newCards) {
    if (cards.some(c => c.name === card.name)) {
      console.log(`[DEBUG] Card "${card.name}" already exists in cards.json`);
    } else {
      cards.push(card);
    }
  }

  saveCards(cards);
}

main();
