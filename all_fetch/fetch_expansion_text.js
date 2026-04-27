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
  const types = typesMatch ? typesMatch[1].split(',').map(t => t.trim()) : [];
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
  
    types,
    subtypes: [],
  
    text: cleanedText,
  
    tags: computeTags(cleanedText, types),
    
    dependencies: [],
  
    image: `images/${boxName}/${cardName.replace(/ /g, '_')}.jpg`
  };
}

function computeTags(text, types) {
  const t = text.toLowerCase();
  const tags = new Set();
  const typeList = types.map(t => t.toLowerCase());

  // CARD GIVES
  if (/\+\d+ cards?/i.test(text)) tags.add('+cards');
  if (/\+\d+ actions?/i.test(text)) tags.add('+actions');
  if (/\+\d+ buys?/i.test(text)) tags.add('+buys');
  if (/\+\s*\(\d+\)/i.test(text)) tags.add('+coins');
  if (/\+\d+ coffers?/i.test(t)) tags.add('+coffers');
  if (/\+\d+ villagers?/i.test(t)) tags.add('+villagers');
  if (/\+\d+ favors?/i.test(t)) tags.add('+favors');
  if (/\+\d+ (?:victory token|\{)/i.test(t)) tags.add('+vp_tokens');

  // COST
  if (/\[1\]/.test(text)) tags.add('potion');
  if (/<\d+>/.test(text)) tags.add('debt');
  if (/overpay|pay extra/i.test(t)) tags.add('overpay');
  if (/cost.*less|costs? \(?[0-9]+\)? less|reduce.*cost/i.test(t)) tags.add('cost_reduction');

  // CARD MOVEMENT
  if (tags.has('+cards') || /draw \d/i.test(t)) tags.add('draw');
  if (/discard/i.test(t)) tags.add('discard');
  if (/\btrash\b/i.test(t)) tags.add('trash');
  if (/gain a|gain an|gain up to|gains a/i.test(t)) tags.add('gain');
  if (/onto your deck|top of your deck|put.*on top/i.test(t)) tags.add('topdeck');
  if (/\bexile\b/i.test(t)) tags.add('exile');
  if (/set (it |this |them )?aside/i.test(t)) tags.add('set_aside');
  if (/exchange/i.test(t)) tags.add('exchange');

  // TRIGGERS
  if (/when you gain/i.test(t)) tags.add('on_gain');
  if (/when you buy/i.test(t)) tags.add('on_buy');
  if (/when you trash/i.test(t)) tags.add('on_trash');
  if (/when you discard/i.test(t)) tags.add('on_discard');
  if (/when another player plays an attack/i.test(t)) tags.add('on_attack');
  if (typeList.includes('duration')) tags.add('duration');
  if (/each of your turns|at the start of each/i.test(t)) tags.add('each_turn');

  // ATTACKS
  if (/each other player|another player/i.test(t)) tags.add('attack');
  if (/gain a curse|gain a ruins|gains a copper/i.test(t)) tags.add('junking');
  if (/discard down to|discard.*each other player/i.test(t)) tags.add('discard_attack');
  if (/trash.*each other player|each other player.*trash/i.test(t)) tags.add('trash_attack');
  if (/top of their deck|top of each other player.*deck/i.test(t)) tags.add('deck_attack');
  if (/reveals? (?:their )?hand/i.test(t)) tags.add('hand_reveal');

  // TRASHING
  if (/trash this|return this to its pile/i.test(t)) tags.add('trash_self');
  if (tags.has('trash') && (tags.has('+cards') || tags.has('+coins') || tags.has('+actions') || tags.has('gain'))) tags.add('trash_for_benefit');
  if (/trash.*gain|trash.*to gain/i.test(t)) tags.add('trash_to_gain');

  // GAINING
  if (/gain.*to your hand|gain.*into your hand/i.test(t)) tags.add('gain_to_hand');
  if (/gain.*onto your deck|gain.*to your deck/i.test(t)) tags.add('gain_to_deck');
  if (/not in the supply|non-supply/i.test(t)) tags.add('gain_non_supply');

  // DECK CONTROL
  if (/look at the top|reveal.*top|top \d+ cards of your deck/i.test(t)) tags.add('scry');
  if (/reorder|in any order|rearrange/i.test(t)) tags.add('reorder');
  if (/search your deck|look through your deck/i.test(t)) tags.add('search_deck');

  // SPECIAL RESOURCES
  if (/spoils/i.test(t)) tags.add('uses_spoils');
  if (/\bhorse\b/i.test(t)) tags.add('uses_horses');
  if (/\bloot\b/i.test(t)) tags.add('uses_loot');
  if (/\bboon\b/i.test(t)) tags.add('uses_boons');
  if (/\bhex\b/i.test(t)) tags.add('uses_hexes');

  // RULE MODIFIERS
  if (/take an extra turn|extra turn/i.test(t)) tags.add('extra_turn');
  if (/extra buy phase/i.test(t)) tags.add('extra_buy_phase');
  if (/at the start of your next turn|next turn/i.test(t) && typeList.includes('duration')) tags.add('persistent');
  if (/all players|everyone|each player/i.test(t)) tags.add('global_effect');

  // REACTIONS
  if (/when another player plays an attack/i.test(t) && typeList.includes('reaction')) tags.add('reaction_attack');
  if (/when.*gain/i.test(t) && typeList.includes('reaction')) tags.add('reaction_gain');
  if (/when.*trash/i.test(t) && typeList.includes('reaction')) tags.add('reaction_trash');

  // RESERVE
  if (/tavern mat|call.*from.*tavern/i.test(t) || typeList.includes('reserve')) tags.add('tavern_mat');

  // DERIVED
  const isAction = typeList.includes('action');
  const hasActions = tags.has('+actions');
  const hasCards = tags.has('+cards') || tags.has('draw');
  if (tags.has('draw') || tags.has('+actions') || tags.has('trash')) tags.add('engine_piece');
  if (tags.has('+coins') || tags.has('+buys') || tags.has('+coffers')) tags.add('payload_piece');
  if (isAction && !hasActions) tags.add('terminal');
  if (tags.has('+actions') && /\+[2-9] actions?/i.test(text)) tags.add('village');
  if (hasCards && hasActions) tags.add('cantrip');
  if (hasCards && !hasActions && isAction) tags.add('terminal_draw');
  if (hasCards && hasActions) tags.add('non_terminal_draw');

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
