// parse_card_names.js
const fs = require('fs');
const path = require('path');

const rawText = fs.readFileSync(path.join(__dirname, 'card_names_raw.json'), 'utf-8');
const raw = rawText
  .trim()
  .slice(1, -1) // remove outer [ ]
  .split(/",\s*\n\s*"/) // split on line boundaries
  .map(s => s.replace(/^"|"$/g, '').replace(/\\t/g, '\t'));

function cleanName(name) {
  return name.replace(/[^a-zA-Z0-9'',\- ]/g, '').trim();
}

function stripCosts(str) {
  return str.replace(/\$[\d*]+[+]?\$[\d*]+[+]?|\d+D\d+D|PP|\d+P\d+P|\d+star\d+star/g, '').trim();
}

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

// Parse a segment that may contain parenthetical subgroups
function parseSegment(seg) {
  seg = seg.trim();
  if (!seg) return [];

  const results = [];

  // Handle split piles with /
  if (seg.includes('/') && !seg.includes('(')) {
    const parts = seg.split('/').map(s => cleanName(s.trim()));
    results.push({ name: parts[0], paired_with: parts[1] });
    results.push({ name: parts[1], paired_with: parts[0] });
    return results;
  }

  // Handle card with parenthetical
  const parenMatch = seg.match(/^(.+?)\s*\(([^)]+)\)(.*)$/);
  if (parenMatch) {
    const parentName = cleanName(parenMatch[1].trim());
    const inner = parenMatch[2].trim();
    const after = parenMatch[3].trim();

    // Named subgroup like "Zombies: Apprentice • Mason • Spy"
    const namedGroup = inner.match(/^(\w+):\s*(.+)$/);
    if (namedGroup) {
      const groupName = namedGroup[1];
      const subCards = namedGroup[2].split('•').map(s => cleanName(s.trim())).filter(Boolean);
      const prefixedCards = subCards.map(c => `${groupName} ${c}`);
      results.push({ name: parentName, subgroup: prefixedCards });
    } else if (inner.includes('/')) {
      // Split pile inside parens like Misery (Miserable/Twice Miserable)
      const subParts = inner.split('/').map(s => cleanName(s.trim()));
      results.push({ name: parentName, subgroup: subParts });
    } else {
      // Heirlooms or traveller sub-cards separated by •
      const subCards = inner.split('•').map(s => cleanName(s.trim())).filter(Boolean);
      if (travellerChains[parentName]) {
        results.push({ name: parentName, chain: travellerChains[parentName] });
      } else {
        // Heirloom — single sub-card
        if (subCards.length === 1) {
          results.push({ name: parentName, heirloom: subCards[0] });
          results.push({ name: subCards[0], parent: parentName });
        } else {
          // Multiple sub-cards like Fool (Lost in the Woods • Lucky Coin)
          results.push({ name: parentName, heirloom: subCards });
          for (const sub of subCards) {
            results.push({ name: sub, parent: parentName });
          }
        }
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
      const subNames = inner.split('/').map(s => cleanName(s.trim()));
      results.push({ name: parentName });
      for (const sub of subNames) results.push({ name: sub, parent: parentName });
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
    if (!output[currentExpansion].removed) output[currentExpansion].removed = [];
    output[currentExpansion].removed.push(...cards);
    continue;
  }

  // Expansion line
  if (trimmed.includes('\t')) {
    currentExpansion = trimmed.split('\t')[0].trim();
    output[currentExpansion] = { kingdom: [] };
    const cards = parseCardLine(trimmed);
    output[currentExpansion].kingdom.push(...cards);
    continue;
  }
}

// Add States group to Nocturne
if (output['Nocturne']) {
  output['Nocturne'].kingdom.push({
    name: 'States',
    subgroup: ['Deluded', 'Envious', 'Miserable', 'Twice Miserable']
  });
}

// Sort all kingdoms and landscapes by name
for (const exp of Object.keys(output)) {
  output[exp].kingdom = sortByName(output[exp].kingdom);
  if (output[exp].removed) output[exp].removed = sortByName(output[exp].removed);
  for (const type of Object.values(landscapeKeywords)) {
    if (output[exp][type]) output[exp][type] = sortByName(output[exp][type]);
  }
}

// Compact JSON serialization - one card per line
const json = JSON.stringify(output, null, 2).replace(
  /\{\s*"name":\s*"([^"]+)"([^}]*)\}/gs,
  (match) => match.replace(/\s+/g, ' ')
);

fs.writeFileSync(path.join(__dirname, 'card_names.json'), '', 'utf-8');
console.log('[DEBUG] Cleared card_names.json');
