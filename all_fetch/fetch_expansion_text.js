// fetch_expansion_text.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const cardNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'card_names.json'), 'utf-8'));
const rawDir = path.join(__dirname, '..', 'raw');
const rawTextDir = path.join(__dirname, '..', 'all_fetch/raw_text');

const aliases = { 'Harem': 'Farm' };

function cleanText(text) {
  return text
    .replace(/{{VP\|'{0,3}(\+?\d+)'{0,3}[^}]*}}/gi, (_, n) => n.startsWith('+') ? `+{${n.slice(1)}}` : `{${n}}`)
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
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .split(/\s+/)
    .map(word => {
      if (word === '|') return word;
      if (/^\d+$/.test(word)) return word;
      word = word.replace(/^[^a-zA-Z0-9;:.,!?()\[\]{}<>+_]+|[^a-zA-Z0-9;:.,!?()\[\]{}<>_]+$/g, '');
      word = word.replace(/[^a-zA-Z0-9;:.,!?()\[\]{}<>+_\s]/g, '');
      if (/^[+<(\[{]/.test(word)) return word;
      if (word.includes('_')) return word;
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
  if (!raw) return null;
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

async function fetchAndParseCard(cardName, sharedPage) {
  cardName = aliases[cardName] || cardName;
  const safeFileName = cardName.replace(/'/g, '%27');
  const localPath = path.join(rawDir, `${safeFileName}.json`);

  let fileData = null;
  let wikitext = '';

  if (fs.existsSync(localPath)) {
    console.log(`[CACHE] "${cardName}"`);
    fileData = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    wikitext = fileData.infobox || fileData.list || '';
    const textFields = [];
    let i = 1;
    while (true) {
      const key = i === 1 ? 'text' : `text${i}`;
      if (!fileData[key]) break;
      textFields.push(fileData[key]);
      i++;
    }
    fileData._textFields = textFields;
  } else {
    console.log(`[FETCH] "${cardName}"`);
    const url = `https://wiki.dominionstrategy.com/api.php?action=parse&page=${encodeURIComponent(cardName)}&prop=wikitext&format=json`;
    await sharedPage.goto(url, { waitUntil: 'networkidle2', timeout: 100000 });
    let rawData = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await sharedPage.waitForFunction(
          () => document.body.innerText.trim().startsWith('{'),
          { timeout: 100000 }
        );
        rawData = await sharedPage.evaluate(() => document.body.innerText);
        break;
      } catch (err) {
        console.log(`[DEBUG] Attempt ${attempt} failed, retrying...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!rawData) throw new Error(`Failed to fetch "${cardName}"`);

    const parsed = JSON.parse(rawData);
    const wikiRaw = parsed?.parse?.wikitext?.['*'] || '';
    const infoboxMatch = wikiRaw.match(/{{Infobox [\s\S]+?\n}}/i);

    let saveData = {};
    if (infoboxMatch) {
      saveData.infobox = infoboxMatch[0];
      const textFields = [];
      const baseText = wikiRaw.match(/\|\s*text\s*=\s*([\s\S]+?)(?=\n\s*[|}])/i);
      if (baseText) textFields.push(baseText[1]);
      let i = 2;
      while (true) {
        const match = wikiRaw.match(new RegExp(`\\|\\s*text${i}\\s*=\\s*([\\s\\S]+?)(?=\\n\\s*[|}])`, 'i'));
        if (!match) break;
        textFields.push(match[1]);
        i++;
      }
      textFields.forEach((t, idx) => {
        saveData[idx === 0 ? 'text' : `text${idx + 1}`] = t;
      });
      fileData = { ...saveData, _textFields: textFields };
    }

    const listMatch = wikiRaw.match(/==\s*List of [^=]+==\s*([\s\S]+?)(?=\n==|$)/i);
    if (listMatch) saveData.list = listMatch[1];
    else if (!infoboxMatch) saveData.list = wikiRaw;

    if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir);
    fs.writeFileSync(localPath, JSON.stringify(saveData, null, 2), 'utf-8');
    wikitext = saveData.infobox || saveData.list || '';
  }

  if (!wikitext) {
    console.error(`[FAIL] "${cardName}" — no wikitext`);
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

  const textFields = fileData?._textFields || [];
  if (textFields.length === 0) {
    const baseText = wikitext.match(/\|\s*text\s*=\s*([\s\S]+?)(?=\n\s*[|}])/i);
    if (baseText) textFields.push(baseText[1]);
    let i = 2;
    while (true) {
      const match = wikitext.match(new RegExp(`\\|\\s*text${i}\\s*=\\s*([\\s\\S]+?)(?=\\n\\s*[|}])`, 'i'));
      if (!match) break;
      textFields.push(match[1]);
      i++;
    }
  }

  const rawText = textFields.join(' | ').trim();
  const cleanedText = rawText ? cleanText(rawText) : '';

  return {
    name: cardName,
    supply,
    set: kingdomMatch ? kingdomMatch[1].trim() : 'Unknown',
    edition: editionMatch ? editionMatch[1].trim() : 'Unknown',
    cost: costMatch || cost2Match || cost3Match ? (
      costMatch && cost2Match
        ? formatCost(costMatch[1], costExtra, false) + formatCost(cost2Match[1], costExtra, true)
        : cost3Match
        ? formatCost(costMatch ? costMatch[1] : null, costExtra, false) + '[1]'
        : formatCost(costMatch ? costMatch[1] : cost2Match ? cost2Match[1] : null, costExtra, !!cost2Match && !costMatch)
    ) : null,
    types: typesMatch ? typesMatch[1].split(',').map(t => t.trim()) : [],
    text: cleanedText
  };
}

async function main() {
  const expansionInput = process.argv[2];
  if (!expansionInput) {
    console.error('Usage: node fetch_expansion_text.js "Expansion Name"');
    process.exit(1);
  }

  // Case-insensitive match against card_names.json keys
  const expansionName = Object.keys(cardNames).find(
    k => k.toLowerCase() === expansionInput.toLowerCase()
  );
  if (!expansionName || expansionName === 'all_total') {
    console.error(`[ERROR] Expansion "${expansionInput}" not found in card_names.json`);
    process.exit(1);
  }

  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir);
  if (!fs.existsSync(rawTextDir)) fs.mkdirSync(rawTextDir);

  const box = cardNames[expansionName];
  const allSections = Object.entries(box).filter(([k]) => k !== 'Card Count');

  // Collect all card names to fetch
  const toFetch = [];
  for (const [, cards] of allSections) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      toFetch.push(card.name);
      if (card.group && Array.isArray(card.group)) toFetch.push(...card.group);
      if (card.paired_with) toFetch.push(card.paired_with);
      if (card.chain) toFetch.push(...card.chain);
    }
  }

  const results = [];
  const failed = [];

  const browser = await puppeteer.launch({ headless: true });
  try {
    const sharedPage = await browser.newPage();
    for (const cardName of toFetch) {
      try {
        const card = await fetchAndParseCard(cardName, sharedPage);
        if (card) {
          results.push(card);
          console.log(`[DONE] ${cardName}`);
        } else {
          failed.push(cardName);
        }
      } catch (err) {
        console.error(`[FAIL] ${cardName} — ${err.message}`);
        failed.push(cardName);
      }
    }
  } finally {
    await browser.close();
  }

  const outPath = path.join(rawTextDir, `${expansionName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n[SAVED] raw_text/${expansionName}.json (${results.length} cards)`);

  if (failed.length > 0) {
    console.log(`\nFailed cards (${failed.length}):`);
    for (const name of failed) console.log(`  - ${name}`);
  } else {
    console.log('All cards fetched successfully!');
  }
}

main();
