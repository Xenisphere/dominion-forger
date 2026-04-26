// fetch_expansion_text.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const cardNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'storage', 'card_names.json'), 'utf-8'));
const rawTextDir = path.join(__dirname, '..', 'parsed_text');

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

function buildCardLookup() {
  const lookup = {};
  const boxes = Object.keys(cardNames).filter(k => k !== 'all_total');

  boxes.forEach((boxName, boxIdx) => {
    const boxNum = String(boxIdx + 1).padStart(2, '0');
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
    allCards.sort((a, b) => a.localeCompare(b));
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
  
  const lookupInfo = lookup[cardName];
  const boxName = lookupInfo ? lookupInfo.boxName : 'Unknown';
  const editionRaw = editionMatch ? editionMatch[1].trim() : null;
  const editionCode = formatEdition(editionRaw);
  const id = lookupInfo
  ? `${lookupInfo.boxNum}${lookupInfo.position}${lookupInfo.total}`
  : null;

  return {
    name: cardName,
    id,
    supply,
    box: lookupInfo ? lookupInfo.boxName : 'Unknown',
    edition: editionRaw || 'Unknown',
    removed: editionRaw === '1',
  
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
  
    types: typesMatch ? typesMatch[1].split(',').map(t => t.trim()) : [],
    subtypes: [],
  
    text: cleanedText,
  
    tags: computeTags(cleanedText, types, gives_cards, gives_actions, gives_buys, gives_coins),
  
    has_on_gain: /when you gain/i.test(cleanedText),
    has_on_buy: /when you buy/i.test(cleanedText),
  
    gives_cards: /\+\d+ cards?/i.test(cleanedText),
    gives_actions: /\+\d+ actions?/i.test(cleanedText),
    gives_buys: /\+\d+ buys?/i.test(cleanedText),
    gives_coins: /\+\d*\s*\(\d+\)|\+\(?[0-9]+\)?/i.test(cleanedText),
  
    needs_setup: false,
    dependencies: [],
  
    image: `images/${boxName}/${cardName.replace(/ /g, '_')}.jpg`
  };
}

function computeTags(text, types, gives_cards, gives_actions, gives_buys, gives_coins) {
  const t = text.toLowerCase();
  const tags = new Set();

  // DRAW / HAND CONTROL
  if (gives_cards || /\+\d+ cards?/i.test(text) || /draw\s+\d/i.test(t)) tags.add('draw');
  if (gives_cards && gives_actions) tags.add('cantrip');
  if (/discard/i.test(t)) tags.add('discard');
  if (/reveal|look at the top|top \d+ cards|set aside.*deck/i.test(t)) tags.add('scry');
  if (/onto your deck|top of.*deck|put.*on top/i.test(t)) tags.add('topdeck');

  // ACTIONS / FLOW
  if (gives_actions) tags.add('actions');
  if (/\+2 actions|\+3 actions|\+4 actions/i.test(text)) tags.add('village');
  const isAction = types.some(t => t.toLowerCase().includes('action'));
  if (isAction && !gives_actions) tags.add('terminal');

  // ECONOMY
  if (gives_coins) tags.add('coin');
  if (gives_buys) tags.add('buy');
  if (gives_coins || gives_buys) tags.add('payload');
  if (/cost[s]?\s+\(?[0-9]*\)?\s+less|cost[s]?\s+[0-9]*\s+more|reduce.*cost|increase.*cost/i.test(t)) tags.add('cost_control');

  // GAIN
  if (/gain a|gain an|gain up to|gains a/i.test(t)) tags.add('gain');

  // TRASHING / DECK CONTROL
  if (/trash/i.test(t)) tags.add('trash');
  if (/trash this|return this to|trash it/i.test(t)) tags.add('self_trash');
  if (tags.has('trash') && (gives_cards || gives_coins || gives_actions || tags.has('gain'))) tags.add('trash_benefit');
  if (/look at.*choose|pick one|select|you may discard.*for/i.test(t)) tags.add('filtering');

  // INTERACTION
  if (/each other player|another player/i.test(t)) tags.add('attack');
  if (/gain a curse|gain a ruins|gains a copper|gain copper/i.test(t)) tags.add('junking');
  if (/discard down to|reveals? (?:their )?hand|discard.*each other player/i.test(t)) tags.add('hand_attack');
  if (/top of their deck|top of (?:each )?other player|deck.*attack/i.test(t)) tags.add('deck_attack');

  // TRIGGERS
  if (/when you gain/i.test(t)) tags.add('on_gain');
  if (/when you buy/i.test(t)) tags.add('on_buy');

  // SPECIAL MECHANICS
  if (types.some(t => t.toLowerCase().includes('duration'))) tags.add('duration');
  if (/next turn|at the start of your next|each of your turns/i.test(t)) tags.add('multi_turn');
  if (/victory token|\{[0-9]+\}/i.test(t) && !/^\{[0-9]+\}$/.test(t.trim())) tags.add('vp_tokens');
  if (/\{[0-9]+\}|victory point|worth.*vp/i.test(t)) tags.add('alt_vp');

  // SETUP / EXTRAS
  if (/spoils|horse|will-o'-wisp|imp|ghost|wish|madman|mercenary|bat|pouch|cursed gold|magic lamp|pasture|goat|flag|key|treasure chest|loot/i.test(t)) tags.add('extra_cards');
  if (/heirloom|bane|this is not in the supply|set aside.*before/i.test(t)) tags.add('setup');

  // DERIVED
  if (tags.has('draw') || tags.has('village') || tags.has('trash')) tags.add('engine_piece');
  if (tags.has('coin') || tags.has('buy')) tags.add('payload_piece');
  if (tags.has('draw') && !tags.has('actions')) tags.add('terminal_draw');
  if (tags.has('draw') && tags.has('actions')) tags.add('non_terminal_draw');
  if (tags.has('gain') && tags.has('actions')) tags.add('gain_engine');
  if (tags.has('trash') && tags.has('actions')) tags.add('trash_engine');

  // FALLBACK
  if (tags.size === 0) tags.add('utility');

  return [...tags];
}

async function main() {
  const expansionInput = process.argv[2];
  if (!expansionInput) {
    console.error('Usage: node fetch_expansion_text.js "Expansion Name" or "all"');
    process.exit(1);
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
  const browser = await puppeteer.launch({ headless: true });
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
            console.log(`[DONE] ${cardName}`);
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

      if (failed.length > 0) {
        console.log(`Failed (${failed.length}): ${failed.join(', ')}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main();
