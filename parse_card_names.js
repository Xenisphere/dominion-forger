// parse_card_names.js
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'card_names_raw.json'), 'utf-8'));

// Cost parsing for sorting
function parseCostValue(cost) {
  if (!cost) return 9999;
  if (cost.includes('D')) return 1000 + parseInt(cost);
  if (cost.includes('P')) return parseInt(cost) * 10 + 5;
  return parseInt(cost) * 10;
}

// Strip cost tokens from a string
function stripCosts(str) {
  return str.replace(/\$[\d*]+[+]?\$[\d*]+[+]?|\d+D\d+D|PP|\d+P\d+P|\d+\*\d+\*|\$[\w*]+/g, '').trim();
}

// Parse individual card names separated by bullets, handling subgroups
function parseCardList(str) {
  const cards = [];
  // Split by bullet but keep parenthetical groups intact
  const parts = str.split('•').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    const parenMatch = part.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (parenMatch) {
      const parentName = parenMatch[1].trim();
      const inner = parenMatch[2].trim();

      // Check if it's a named group like "Rewards:", "Prizes:", "Zombies:"
      const namedGroupMatch = inner.match(/^(\w+):\s*(.+)$/);
      if (namedGroupMatch) {
        const groupName = namedGroupMatch[1];
        const groupCards = namedGroupMatch[2].split('•').map(s => s.trim()).filter(Boolean);
        cards.push({
          name: parentName,
          subgroup: { name: groupName, cards: groupCards }
        });
      } else {
        // Check separator type - '/' means split pile, '•' means gained cards
        const subCards = inner.split(/[•]/).map(s => s.trim()).filter(Boolean);
        cards.push({ name: parentName, heirlooms: subCards });
      }
    } else if (part.includes('/')) {
      // Split pile
      const splitNames = part.split('/').map(s => s.trim());
      cards.push({ name: splitNames[0], paired_with: splitNames[1] });
      cards.push({ name: splitNames[1], paired_with: splitNames[0] });
    } else {
      cards.push({ name: part });
    }
  }
  return cards;
}

// Parse a line of cards with costs
function parseCardsWithCosts(str) {
  str = str.replace(/^[A-Za-z &]+\t/, '').trim(); // remove expansion name prefix

  const result = [];
  // Split on cost tokens, keeping the token
  const costPattern = /(\$[\d*]+[+]?\$[\d*]+[+]?|\d+D\d+D|PP|\d+P\d+P)/g;
  const segments = str.split(costPattern).filter(Boolean);

  let currentCost = null;
  for (const seg of segments) {
    if (costPattern.test(seg) || /^\$[\d*]+[+]?\$[\d*]+[+]?$|^\d+D\d+D$|^PP$/.test(seg)) {
      currentCost = seg
        .replace(/\$(\d+)[+]?\$\d+[+]?/, '$1')
        .replace(/(\d+)D\d+D/, '$1D')
        .replace('PP', 'P');
    } else {
      const cards = parseCardList(stripCosts(seg));
      for (const card of cards) {
        card.cost = currentCost;
        result.push(card);
      }
    }
  }
  return result;
}

// Parse landscape cards (no costs or with costs)
function parseLandscape(str, type) {
  str = str.replace(/^[^:]+:\s*/, '').trim();
  const hasCosts = /\$\d|\dD/.test(str);

  if (hasCosts) {
    return parseCardsWithCosts(str).map(c => ({ ...c, landscape_type: type }));
  } else {
    return str.split('•').map(s => s.trim()).filter(Boolean).map(name => {
      const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (parenMatch) {
        const parentName = parenMatch[1].trim();
        const subNames = parenMatch[2].split('/').map(s => s.trim());
        const cards = [{ name: parentName, landscape_type: type, cost: null }];
        for (const sub of subNames) {
          cards.push({ name: sub, landscape_type: type, cost: null, parent: parentName });
        }
        return cards;
      }
      return [{ name, landscape_type: type, cost: null }];
    }).flat();
  }
}

// Traveller chains
const travellerChains = {
  'Page': ['Page', 'Treasure Hunter', 'Warrior', 'Hero', 'Champion'],
  'Peasant': ['Peasant', 'Soldier', 'Fugitive', 'Disciple', 'Teacher'],
};

// Pile definitions - cards that need prefix handling
const knightPrefixes = {
  'Dames': 'Dame',
  'Sirs': 'Sir',
};

function expandKnights(cards) {
  const result = [];
  let currentPrefix = null;
  for (const card of cards) {
    if (knightPrefixes[card.name]) {
      currentPrefix = knightPrefixes[card.name];
    } else {
      if (currentPrefix) card.name = `${currentPrefix} ${card.name}`;
      result.push(card);
    }
  }
  return result;
}

// Pile groups that should be nested
const pileGroups = ['Ruins', 'Shelters', 'Castles', 'Knights', 'Townsfolk', 'Augurs',
  'Clashes', 'Forts', 'Odysseys', 'Wizards', 'Loots', 'Prizes', 'Rewards'];

const stateCards = ['Deluded', 'Envious', 'Miserable', 'Twice Miserable'];

function buildExpansion(line, expansionName) {
  const isRemoved = line.startsWith('Removed cards:');
  const cardsStr = isRemoved ? line.replace('Removed cards:', '').trim() : line;
  const parsed = parseCardsWithCosts(cardsStr);

  const kingdom = [];
  const removed = [];

  for (const card of parsed) {
    if (!card.name) continue;

    // Handle pile groups
    const pileMatch = pileGroups.find(p => card.name === p);
    if (pileMatch && card.subgroup) {
      const entry = {
        name: pileMatch,
        pile: true,
        cost: card.cost,
        cards: card.subgroup.cards
      };
      if (pileMatch === 'Knights') entry.cards = expandKnights(
        entry.cards.map(n => ({ name: n }))
      ).map(c => c.name);
      (isRemoved ? removed : kingdom).push(entry);
      continue;
    }

    // Handle heirlooms
    if (card.heirlooms) {
      const entry = { name: card.name, cost: card.cost, heirloom: card.heirlooms[0] };
      (isRemoved ? removed : kingdom).push(entry);
      for (const h of card.heirlooms) {
        (isRemoved ? removed : kingdom).push({ name: h, cost: null, parent: card.name });
      }
      continue;
    }

    // Handle named subgroups like Zombies
    if (card.subgroup) {
      const entry = {
        name: card.name,
        cost: card.cost,
        subgroup: {
          name: card.subgroup.name,
          cards: card.subgroup.cards
        }
      };
      (isRemoved ? removed : kingdom).push(entry);
      continue;
    }

    // Handle traveller chains
    const chainKey = Object.keys(travellerChains).find(k => k === card.name);
    if (chainKey) {
      const entry = {
        name: card.name,
        cost: card.cost,
        pile: true,
        cards: travellerChains[chainKey]
      };
      (isRemoved ? removed : kingdom).push(entry);
      continue;
    }

    const entry = { name: card.name, cost: card.cost };
    if (isRemoved) entry.removed = true;
    (isRemoved ? removed : kingdom).push(entry);
  }

  return { kingdom, removed };
}

function sortCards(cards) {
  return cards.sort((a, b) => {
    const costA = parseCostValue(a.cost);
    const costB = parseCostValue(b.cost);
    if (costA !== costB) return costA - costB;
    return a.name.localeCompare(b.name);
  });
}

// Main parsing
const output = {};
let currentExpansion = null;
const landscapeBuffer = [];

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

for (const line of raw) {
  const trimmed = line.trim();

  // Check for landscape line
  const landscapeKey = Object.keys(landscapeKeywords).find(k => trimmed.startsWith(k));
  if (landscapeKey) {
    const type = landscapeKeywords[landscapeKey];
    const cards = parseLandscape(trimmed, type);
    if (currentExpansion) {
      if (!output[currentExpansion].landscape) output[currentExpansion].landscape = [];
      output[currentExpansion].landscape.push(...cards);
    }
    continue;
  }

  // Check for removed cards
  if (trimmed.startsWith('Removed cards:')) {
    if (currentExpansion) {
      const { removed } = buildExpansion(trimmed, currentExpansion);
      if (!output[currentExpansion].removed) output[currentExpansion].removed = [];
      output[currentExpansion].removed.push(...removed);
    }
    continue;
  }

  // Check for expansion line (has tab)
  if (trimmed.includes('\t')) {
    currentExpansion = trimmed.split('\t')[0].trim();
    output[currentExpansion] = { kingdom: [], landscape: [], removed: [] };
    const { kingdom } = buildExpansion(trimmed, currentExpansion);
    output[currentExpansion].kingdom.push(...kingdom);
    continue;
  }
}

// Add Nocturne states group
if (output['Nocturne']) {
  output['Nocturne'].kingdom.push({
    name: 'States',
    pile: true,
    cost: null,
    cards: stateCards
  });
}

// Sort all cards
for (const exp of Object.keys(output)) {
  output[exp].kingdom = sortCards(output[exp].kingdom);
  if (output[exp].landscape) {
    const withCost = output[exp].landscape.filter(c => c.cost !== null);
    const withoutCost = output[exp].landscape.filter(c => c.cost === null);
    output[exp].landscape = [...sortCards(withCost), ...sortCards(withoutCost)];
  }
}

fs.writeFileSync(
  path.join(__dirname, 'card_names.json'),
  JSON.stringify(output, null, 2),
  'utf-8'
);

console.log(`[DEBUG] Saved card_names.json with ${Object.keys(output).length} expansions`);
