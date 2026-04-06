// parse_card_names.js
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'card_names_raw.json'), 'utf-8'));

function cleanName(name) {
  const original = name;
  if (original.toLowerCase().includes('eddler')) console.log('[DEBUG] Peddler:', JSON.stringify(original), '->', JSON.stringify(name));
  name = name.replace(/[^a-zA-Z'\- ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/[^a-zA-Z'\- ]/.test(name)) return '';
  if (name.length <= 1) return '';
  if (/^[a-z]/.test(name)) return '';
  return name;
}

function stripCosts(str) {
  str = str.replace(/(\$\d+[*+]*|\d+D|\d+P|\d+star|\bPP\b)+/g, '•');   // catch all chained cost tokens in one pass
  str = str.replace(/\$\d+star\$?\d*star?/g, '•');                     // $8star$8star
  str = str.replace(/\b\d+[A-Za-z]+\b/g, '•');                         // leftover digit+letter fragment
  str = str.replace(/\bstar\b/g, '•');                                 // catch any remaining star fragments
  str = str.replace(/\bPP\s*/g, '•');                                  // PP prefix before card names
  str = str.replace(/•+/g, '•');                                       // collapse multiple bullets
  return str.trim();
}

  function countCards(arr) {
    let count = 0;
    for (const card of arr) {
      count++;
      if (Array.isArray(card.group)) count += card.group.length;
      else if (card.group) count += 1;
      if (card.paired_with) count += 1;
      if (Array.isArray(card.chain)) count += card.chain.length - 1;
    }
    return count;
  }

const pileGroups = ['Ruins', 'Shelters', 'Castles', 'Loots', 'Knights'];

const travellerChains = {
  'Page': ['Page', 'Treasure Hunter', 'Warrior', 'Hero', 'Champion'],
  'Peasant': ['Peasant', 'Soldier', 'Fugitive', 'Disciple', 'Teacher'],
};

const knightDames = ['Anna', 'Josephine', 'Molly', 'Natalie', 'Sylvia'];
const knightSirs = ['Bailey', 'Destry', 'Martin', 'Michael', 'Vander'];

function expandKnightNames(cards) {
  const result = [];
  let prefix = null;
  for (const name of cards) {
    if (name === 'Dames') { prefix = 'Dame'; continue; }
    if (name === 'Sirs') { prefix = 'Sir'; continue; }
    result.push(prefix ? `${prefix} ${name}` : name);
  }
  return result;
}

// Parse a segment that may contain parenthetical groups
function parseSegment(seg) {
  seg = seg.trim();
  if (!seg) return [];
  const results = [];

  // Handle split piles with /
  if (seg.includes('/') && !seg.includes('(')) {
    const parts = seg.split('/').map(s => cleanName(s.trim()));
    results.push({ name: parts[0], paired_with: parts[1] });
    return results;
  }

  // Handle card with parenthetical
  const parenMatch = seg.match(/^(.+?)\s*\(([^)]+)\)(.*)$/);
  if (parenMatch) {
    const parentName = cleanName(parenMatch[1].trim());
    const inner = parenMatch[2].trim();
    const after = parenMatch[3].trim();

    // Named group like "Zombies: Apprentice • Mason • Spy"
    const namedGroup = inner.match(/^(\w+):\s*(.+)$/);
    if (namedGroup) {
      const groupName = namedGroup[1];
      const subCards = namedGroup[2].split('•').map(s => cleanName(s.trim())).filter(Boolean);
      const prefixedCards = subCards.map(c => `${groupName} ${c}`);
      results.push({ name: parentName, group: prefixedCards });
    } else if (inner.includes('Dames') || inner.includes('Sirs')) {
      // Knights pile
      const subCards = inner.split('•').map(s => s.trim()).filter(Boolean);
      const knightNames = [];
      let prefix = 'Dame';
      for (const card of subCards) {
        if (card.startsWith('Dames ')) {
          prefix = 'Dame';
          knightNames.push(`Dame ${card.replace('Dames ', '').trim()}`);
        } else if (card.startsWith('Sirs ')) {
          prefix = 'Sir';
          knightNames.push(`Sir ${card.replace('Sirs ', '').trim()}`);
        } else {
          knightNames.push(`${prefix} ${card}`);
        }
      }
      results.push({ name: parentName, group: knightNames });
    } else if (inner.includes('/')) {
      const subParts = inner.split('/').map(s => cleanName(s.trim()));
      results.push({ name: parentName, group: subParts });
    } else {
      const subCards = inner.split('•').map(s => cleanName(s.trim())).filter(Boolean);
      if (travellerChains[parentName]) {
        results.push({ name: parentName, chain: travellerChains[parentName] });
      } else if (pileGroups.includes(parentName)) {
        results.push({ name: parentName, group: subCards });
      } else if (subCards.length === 1) {
          results.push({ name: parentName, paired_with: subCards[0] });
      } else {
        results.push({ name: parentName, group: subCards });
      }
    }

    // Handle any remaining text after the closing paren
    if (after) {
      for (const r of parseSegment(after)) results.push(r);
    }
    return results;
  }

  // Plain card name
  const name = cleanName(seg);
  if (!name) return [];
  if (travellerChains[name]) {
    results.push({ name, chain: travellerChains[name] });
  } else {
    results.push({ name });
  }
  return results;
}

function parseCardLine(str) {
  // Remove expansion name prefix (before tab)
  str = str.replace(/^.+?\t/, '').trim();
  str = stripCosts(str);

  const results = [];
  // Split by bullet but preserve parenthetical groups
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === '•' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    for (const card of parseSegment(part)) results.push(card);
  }

  return results;
}

function parseLandscapeLine(str, type) {
  str = str.replace(/^[^:]+:\s*/, '').trim();
  str = stripCosts(str);

  const results = [];
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === '•' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const parenMatch = part.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (parenMatch) {
      const parentName = cleanName(parenMatch[1].trim());
      const inner = parenMatch[2].trim();
      if (inner.includes('/')) {
        const subNames = inner.split('/').map(s => cleanName(s.trim()));
        results.push({ name: parentName, group: subNames });
      } else {
        const subName = cleanName(inner);
        results.push({ name: parentName, group: subName });
      }
    } else {
      const name = cleanName(part);
      if (name) results.push({ name });
    }
  }

  return results;
}

function sortByName(arr) {
  return arr.sort((a, b) => a.name.localeCompare(b.name));
}

const landscapeKeywords = {
  'Events:': 'Event',
  'Landmarks:': 'Landmark',
  'Projects:': 'Project',
  'Ways:': 'Way',
  'Allies:': 'Ally',
  'Traits:': 'Trait',
  'Prophecies:': 'Prophecy',
  'Boons:': 'Boon',
  'Hexes:': 'Hex',
};

const output = {};
let currentExpansion = null;

for (const line of raw) {
  const trimmed = line.trim();

  // Landscape line
  const landscapeKey = Object.keys(landscapeKeywords).find(k => trimmed.startsWith(k));
  if (landscapeKey && currentExpansion) {
    const type = landscapeKeywords[landscapeKey];
    const cards = parseLandscapeLine(trimmed, type);
    if (!output[currentExpansion][type]) output[currentExpansion][type] = [];
    output[currentExpansion][type].push(...cards);
    continue;
  }

  // Removed cards
  if (trimmed.startsWith('Removed cards:') && currentExpansion) {
    const str = trimmed.replace('Removed cards:', '').trim();
    const cards = parseCardLine('\t' + str);
    if (!output[currentExpansion].Removed) output[currentExpansion].Removed = [];
    output[currentExpansion].Removed.push(...cards);
    continue;
  }

  // Expansion line
  if (trimmed.includes('\t')) {
    currentExpansion = trimmed.split('\t')[0].trim();
    output[currentExpansion] = { Kingdom: [] };
    const cards = parseCardLine(trimmed);
    output[currentExpansion].Kingdom.push(...cards);
    continue;
  }
}

// Sort all kingdoms and landscapes by name
for (const exp of Object.keys(output)) {
  output[exp].Kingdom = sortByName(output[exp].Kingdom);
  if (output[exp].Removed) output[exp].Removed = sortByName(output[exp].Removed);
  for (const type of Object.values(landscapeKeywords)) {
    if (output[exp][type]) output[exp][type] = sortByName(output[exp][type]);
  }
}

for (const exp of Object.keys(output)) {
  const counts = {};
  if (output[exp].Kingdom) counts['Kingdom'] = countCards(output[exp].Kingdom);
  if (output[exp].Removed) counts['Removed'] = countCards(output[exp].Removed);
  for (const type of Object.values(landscapeKeywords)) {
    if (output[exp][type]) counts[type] = countCards(output[exp][type]);
  }
  output[exp]['Card Count'] = counts;
}

let allTotal = 0;
for (const exp of Object.keys(output)) {
  if (exp === 'all_total') continue;
  for (const key of Object.keys(output[exp]['Card Count'] || {})) {
    allTotal += output[exp]['Card Count'][key];
  }
}
output['all_total'] = allTotal;

// Compact JSON serialization - one card per line
const json = JSON.stringify(output, null, 2).replace(
  /\{\s*"name":\s*"([^"]+)"([^}]*)\}/gs,
  (match) => match.replace(/\s+/g, ' ')
);

fs.writeFileSync(path.join(__dirname, 'card_names.json'), '', 'utf-8');
console.log('[DEBUG] Cleared card_names.json');

fs.writeFileSync(path.join(__dirname, 'card_names.json'), json, 'utf-8');
console.log(`[DEBUG] Saved card_names.json with ${Object.keys(output).length} expansions`);
