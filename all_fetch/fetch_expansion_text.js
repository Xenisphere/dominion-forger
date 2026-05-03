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

function computeTags(text, types) {
  const t = text.toLowerCase();
  const tags = new Set();
  const opp_tags = new Set();
  const typeList = types.map(t => t.toLowerCase());

  const oppSections = [...t.matchAll(/(?:each other player|another player|they)[^.]*\.?/g)].map(m => m[0]).join(' ');
  const selfText = t.replace(/(?:each other player|another player|they)[^.]*\./g, '');

  // CARD GIVES
  if (/\+\d+ (?:victory token|\{)/i.test(selfText)) tags.add('+vp_tokens');
  if (/\+\d+ villagers?/i.test(selfText)) tags.add('+villagers');
  if (/\+\d+ coffers?/i.test(selfText)) tags.add('+coffers');
  if (/\+\d+ favors?/i.test(selfText)) tags.add('+favors');
  if (/\+\d+ actions?/i.test(text)) tags.add('+actions');
  if (/\+\s*\(\d+\)/i.test(text)) tags.add('+coins');
  if (/\+\d+ cards?/i.test(text)) tags.add('+cards');
  if (/\+\d+ buys?/i.test(text)) tags.add('+buys');

  // COST
  if (/cost.*less|costs? \(?[0-9]+\)? less|reduce.*cost/i.test(selfText)) tags.add('cost_reduction');
  if (/overpay|pay extra/i.test(selfText)) tags.add('overpay');
  if (/\[1\]/.test(text)) tags.add('potion');
  if (/<\d+>/.test(text)) tags.add('debt');

  // CARD MOVEMENT (self)
  if (/onto your deck|top of your deck|put.*on top/i.test(selfText)) tags.add('topdeck');
  if (/discard(?! pile| them afterwards)/i.test(selfText)) tags.add('discard');
  if (/set (it |this |them )?aside/i.test(selfText)) tags.add('set_aside');
  if (/gain a|gain an|gain up to|gains a/i.test(selfText)) tags.add('gain');
  if (/\btrash(es)?\b/i.test(selfText)) tags.add('trash');
  if (/exchange/i.test(selfText)) tags.add('exchange');
  if (/reveal/i.test(oppSections)) tags.add('reveal');
  if (/\bexile\b/i.test(selfText)) tags.add('exile');

  // CARD MOVEMENT (opponent)
  if (/each player.*discard|discard.*each player|including you.*discard/i.test(t)) opp_tags.add('discard');
  if (/each other player draws|another player draws/i.test(oppSections)) opp_tags.add('+cards');
  if (/each player.*reveal|reveal.*each player|including you/i.test(t)) opp_tags.add('reveal');
  if (/onto their deck|top of their deck/i.test(oppSections)) opp_tags.add('topdeck');
  if (/\btrash(es)?\b/i.test(oppSections)) opp_tags.add('trash');
  if (/gain a|gain an/i.test(oppSections)) opp_tags.add('gain');
  if (/discard/i.test(oppSections)) opp_tags.add('discard');

  // TRIGGERS
  if (/each of your turns|at the start of each/i.test(selfText)) tags.add('each_turn');
  if (/when another player plays an attack/i.test(t)) tags.add('reaction_attack');
  if (typeList.some(t => t.includes('duration'))) tags.add('duration');
  if (/when you discard/i.test(selfText)) tags.add('on_discard');
  if (/when you trash/i.test(selfText)) tags.add('on_trash');
  if (/when you gain/i.test(selfText)) tags.add('on_gain');
  if (/when you buy/i.test(selfText)) tags.add('on_buy');

  // ATTACKS
  if (/each other player|another player|each player/i.test(t) && typeList.some(t => t.includes('attack'))) tags.add('attack');
  if (/\btrash(es)?\b/i.test(oppSections) && typeList.some(t => t.includes('attack'))) tags.add('trash_attack');
  if (/top of their deck|top of (?:each )?other player/i.test(oppSections)) tags.add('deck_attack');
  if (/discard down to|discard.*each other player/i.test(oppSections)) tags.add('discard_attack');
  if (/gains a Curse|gains a Ruins|gains a Copper/i.test(oppSections)) opp_tags.add('junking');
  if (/gain.*Copper|gain.*Curse|gain.*Ruins/i.test(selfText)) tags.add('self_junk');
  if (/reveals? (?:their )?hand/i.test(oppSections)) tags.add('hand_reveal');

  // TRASHING (self)
  if (tags.has('trash') && (tags.has('+cards') || tags.has('+coins') || tags.has('+actions') || tags.has('gain'))) tags.add('trash_for_benefit');
  if (/trash this|return this to its pile/i.test(selfText)) tags.add('trash_self');
  if (/trash.*gain|trash.*to gain/i.test(selfText)) tags.add('trash_to_gain');

  // GAINING (self)
  if (/gain.*to your hand|gain.*into your hand/i.test(selfText)) tags.add('gain_to_hand');
  if (/gain.*onto your deck|gain.*to your deck/i.test(selfText)) tags.add('gain_to_deck');
  if (/not in the supply|non-supply/i.test(selfText)) tags.add('gain_non_supply');

  // DECK CONTROL (self)
  if (/look at the top|reveal.*top|top \d+ cards of your deck|reveal.*until/i.test(selfText)) tags.add('scry');
  if (/search your deck|look through your deck/i.test(selfText)) tags.add('search_deck');
  if (/reorder|in any order|rearrange/i.test(selfText)) tags.add('reorder');

  // DECK CONTROL (opponent)
  if (/look at the top|top \d+ cards of their deck/i.test(oppSections)) opp_tags.add('scry');

  // SPECIAL RESOURCES
  if (/\bhorse\b/i.test(t)) tags.add('uses_horses');
  if (/\bboon\b/i.test(t)) tags.add('uses_boons');
  if (/spoils/i.test(t)) tags.add('uses_spoils');
  if (/\bloot\b/i.test(t)) tags.add('uses_loot');
  if (/\bhex\b/i.test(t)) tags.add('uses_hexes');

  // RULE MODIFIERS
  if (/take an extra turn|extra turn/i.test(selfText)) tags.add('extra_turn');
  if (/all players|everyone|each player/i.test(t)) tags.add('global_effect');
  if (/each of your turns/i.test(selfText)) tags.add('extra_buy_phase');

  // REACTIONS
  if (/when.*trash/i.test(t) && typeList.some(t => t.includes('reaction'))) tags.add('reaction_trash');
  if (/when.*gain/i.test(t) && typeList.some(t => t.includes('reaction'))) tags.add('reaction_gain');

  // RESERVE
  if (/tavern mat|call.*from.*tavern/i.test(t) || typeList.some(t => t.includes('reserve'))) tags.add('tavern_mat');

  // DERIVED
  const isAction = typeList.some(t => t.includes('action'));
  const hasActions = tags.has('+actions');
  const hasCards = tags.has('+cards') || /draw until|reveal.*put.*into your hand/i.test(selfText);
  if (hasCards || tags.has('+actions') || (tags.has('trash') && !tags.has('trash_attack')) || /play.*action.*twice|play.*twice/i.test(selfText)) tags.add('engine_piece');
  if (tags.has('+coins') || tags.has('+buys') || tags.has('+coffers')) tags.add('payload_piece');
  if (tags.has('+actions') && /\+[2-9] actions?/i.test(text)) tags.add('village');
  if (hasCards && !hasActions && isAction) tags.add('terminal_draw');
  if (hasCards && hasActions) tags.add('non_terminal_draw');
  if (isAction && !hasActions) tags.add('terminal');
  if (hasCards && hasActions) tags.add('cantrip');

  // Remove redundant tags
  if (tags.has('non_terminal_draw') || tags.has('terminal_draw')) tags.delete('+cards');
  if (tags.has('non_terminal_draw')) tags.delete('terminal');
  if (tags.has('reaction_attack')) tags.delete('on_attack');
  if (tags.has('terminal_draw')) tags.delete('terminal');
  if (tags.has('village')) tags.delete('+actions');

  // FALLBACK
  if (tags.size === 0) tags.add('utility');

  return { tags: [...tags], opponent_tags: [...opp_tags] };
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

      if (failed.length > 0) {
        console.log(`Failed (${failed.length}): ${failed.join(', ')}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main();
