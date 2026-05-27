// fetch_expansion_text.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const cardNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'storage', 'card_names.json'), 'utf-8'));
const rawTextDir = path.join(__dirname, '..', 'parsed_text');
const computeTags = require('../file_manip/compute_tags');

const aliases = { 'Harem': 'Farm' };

function cleanText(text) {
  return text
    .replace(/{{VP\|'{0,3}(\+?\d+)'{0,3}[^}]*}}/gi, (_, n) => n.startsWith('+') ? `+{${n.slice(1)}}` : `{${n}}`)
    .replace(/{{Costplus\|(\d+)[^}]*}}/gi, '+($1)')
    .replace(/{{Debtplus\|(\d+)[^}]*}}/gi, '+<$1>')
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
    .replace(/{{nowrap\|([^}]+)}}/gi, '$1')
    .split(/\s+/)
    .map(word => {
      if (word === '–1' || word === '-1') return '-1';
      if (word === '|') return word;
      if (/^\d+$/.test(word)) return word;
      word = word.replace(/^[^a-zA-Z0-9;:.,!?()\[\]{}<>+_]+|[^a-zA-Z0-9;:.,!?()\[\]{}<>_]+$/g, '');
      word = word.replace(/[^a-zA-Z0-9;:.,!?()\[\]{}<>+_\s]/g, '');
      if (/^[+<(\[{]/.test(word)) return word;
      if (word.includes('_')) return word;
      if (!/[aeiouyAEIOUY]/.test(word) && !/^\d+$/.test(word)) return '';
      if (word.length === 1 && !/^[aiAI]$/.test(word)) return '';
      return word;
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([;:.,!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildCardLookup() {
  const lookup = {};
  const boxes = Object.keys(cardNames).filter(k => k !== 'all_total');

  boxes.forEach((boxName, boxIdx) => {
    const boxNum = String(boxIdx).padStart(2, '0');
    const box = cardNames[boxName];
    const allSections = Object.entries(box).filter(([k]) => k !== 'Card Count');

    // Collect all cards including sub-cards
    const allCards = [];
    for (const [, cards] of allSections) {
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        allCards.push(card.name);
        if (card.group && Array.isArray(card.group)) allCards.push(...card.group);
        if (card.paired_with) allCards.push(card.paired_with);
        if (card.chain) allCards.push(...card.chain);
      }
    }
    const total = String(allCards.length).padStart(2, '0');

    allCards.forEach((name, idx) => {
      lookup[name] = {
        boxNum,
        boxName,
        position: String(idx + 1).padStart(2, '0'),
        total
      };
    });
  });

  return lookup;
}

function formatEdition(raw) {
  if (!raw) return '10';
  raw = raw.trim();
  if (raw === '1&2') return '11';
  if (raw === '2') return '01';
  return '10';
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

async function fetchAndParseCard(cardName, sharedPage, rawDir, lookup) {
  cardName = aliases[cardName] || cardName;
  const safeFileName = cardName.replace(/'/g, '%27');
  const localPath = path.join(rawDir, `${safeFileName}.json`);

  let fileData = null;
  let wikitext = '';

  if (fs.existsSync(localPath)) {
    //console.log(`[CACHE] "${cardName}"`);
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
      const fullInfobox = infoboxMatch[0];
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

      saveData.infobox = fullInfobox.replace(/\|\s*text\d*\s*=[\s\S]+?(?=\n\s*[|}])/gi, '');
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
  const types = typesMatch ? typesMatch[1].split(',').map(t => t.trim()) : [];
  const lookupInfo = lookup[cardName];
  const boxName = lookupInfo ? lookupInfo.boxName : 'Unknown';
  const editionRaw = editionMatch ? editionMatch[1].trim() : null;
  const editionCode = formatEdition(editionRaw);
  const secondEditionBoxes = ['Dominion', 'Intrigue', 'Seaside', 'Prosperity', 'Hinterlands', 'Cornucopia & Guilds'];
  const removed = secondEditionBoxes.includes(boxName) && editionRaw !== '2' && editionRaw !== '1&2';
  const { tags, opponent_tags } = computeTags(cleanedText, types);
  const id = lookupInfo
  ? `${lookupInfo.boxNum}${lookupInfo.position}${lookupInfo.total}`
  : null;

  return {
    name: cardName,
    id,
    box: lookupInfo ? lookupInfo.boxName : 'Unknown',
    edition: editionRaw || 'Unknown',
    supply,
    removed,
    cost: costMatch || cost2Match || cost3Match ? (
      costMatch && cost2Match
        ? formatCost(costMatch[1], costExtra, false) + formatCost(cost2Match[1], costExtra, true)
        : cost3Match
        ? formatCost(costMatch ? costMatch[1] : null, costExtra, false) + '[1]'
        : formatCost(costMatch ? costMatch[1] : cost2Match ? cost2Match[1] : null, costExtra, !!cost2Match && !costMatch)
    ) : null,
    cost_coin: costMatch ? parseInt(costMatch[1].trim()) : 0,
    cost_debt: cost2Match ? parseInt(cost2Match[1].trim()) : 0,
    cost_potion: !!cost3Match ? 1 : 0,
    text: cleanedText,
    types: typesMatch ? typesMatch[1].split('-').map(t => t.trim()) : [],
    subtypes: [],
    tags,
    opponent_tags,
    dependencies: [],
    image: `images/${boxName}/${cardName.replace(/ /g, '_')}.jpg`
  };
}

async function main() {
  const expansionInput = process.argv[2];
  if (!expansionInput) {
    console.error('Usage: node fetch_expansion_text.js "Expansion Name" or "all"');
    process.exit(1);
  }

  if (expansionInput === '--card') {
    let cardName = process.argv[3];
    if (!cardName) {
      console.error('Usage: node fetch_expansion_text.js --card "Card Name"');
      process.exit(1);
    }
    cardName = cardName.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, c => c.toUpperCase());
    cardName = aliases[cardName] || cardName;

    const lookup = buildCardLookup();
    const lookupInfo = lookup[cardName];
    if (!lookupInfo) {
      console.error(`[ERROR] "${cardName}" not found in card_names.json`);
      process.exit(1);
    }
    const rawDir = path.join(__dirname, '..', 'raw', lookupInfo.boxName);

    const isTermux = process.env.TERMUX_VERSION !== undefined;
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: isTermux ? '/data/data/com.termux/files/usr/bin/chromium-browser' : undefined,
      args: isTermux ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] : []
    });
    try {
      const sharedPage = await browser.newPage();
      const card = await fetchAndParseCard(cardName, sharedPage, rawDir, lookup);
      if (card) console.log('[RESULT]', JSON.stringify(card, null, 2));
      else console.error(`[FAIL] Could not parse "${cardName}"`);
    } finally {
      await browser.close();
    }
    return;
  }

  const expansionNames = expansionInput.toLowerCase() === 'all'
    ? Object.keys(cardNames).filter(k => k !== 'all_total')
    : (() => {
        const match = Object.keys(cardNames).find(k => k.toLowerCase() === expansionInput.toLowerCase());
        if (!match) {
          console.error(`[ERROR] Expansion "${expansionInput}" not found in card_names.json`);
          process.exit(1);
        }
        return [match];
      })();

  if (!fs.existsSync(rawTextDir)) fs.mkdirSync(rawTextDir);

  const lookup = buildCardLookup();
  const isTermux = process.env.TERMUX_VERSION !== undefined;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: isTermux ? '/data/data/com.termux/files/usr/bin/chromium-browser' : undefined,
    args: isTermux ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] : []
  });
  try {
    const sharedPage = await browser.newPage();
    for (const expansionName of expansionNames) {
      console.log(`\n[EXPANSION] ${expansionName}`);
      const rawDir = path.join(__dirname, '..', 'raw', expansionName);

      const box = cardNames[expansionName];
      const allSections = Object.entries(box).filter(([k]) => k !== 'Card Count');

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
      for (const cardName of toFetch) {
        try {
          const card = await fetchAndParseCard(cardName, sharedPage, rawDir, lookup);
          if (card) {
            results.push(card);
            //console.log(`[DONE] ${cardName}`);
          } else {
            failed.push(cardName);
          }
        } catch (err) {
          console.error(`[FAIL] ${cardName} — ${err.message}`);
          failed.push(cardName);
        }
      }

      const outPath = path.join(rawTextDir, `${expansionName}.json`);
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`[SAVED] parsed_text/${expansionName}.json (${results.length} cards)`);

      // After all cards in expansion are parsed into results[]
const nonSupplyNames = new Set(results.filter(c => c.supply === 'Non-Supply').map(c => c.name));

for (const card of results) {
  const gainNonSupply = [...nonSupplyNames].some(name => {
    const pattern = new RegExp(`gain a ${name}|gain an ${name}|gain.*${name}`, 'i');
    return pattern.test(card.text) && !/exchange.*${name}/i.test(card.text);
  });
  if (gainNonSupply) {
    if (!card.tags.includes('gain_non_supply')) card.tags.push('gain_non_supply');
  } else {
    card.tags = card.tags.filter(t => t !== 'gain_non_supply');
  }
  card.tags.sort();
}

      if (failed.length > 0) {
        console.log(`Failed (${failed.length}): ${failed.join(', ')}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main();
