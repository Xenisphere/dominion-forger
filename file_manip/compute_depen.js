// compute_depen.js
const fs = require('fs');
const path = require('path');

const cardNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'storage', 'card_names.json'), 'utf-8'));

const TOKENS = [
  '+1 Card token',
  '-1 Card token',
  '+1 Action token',
  '+1 Buy token',
  '+(1) token',
  '-(1) token',
  '-(2) cost token',
  'Trashing token',
  'Estate token',
];

// Build lookup: name -> { parent, chainmates, paired }
function buildStructure() {
  const parentMap = {};    // name -> parent group name
  const chainMap = {};     // name -> [all other chain members]
  const pairedMap = {};    // name -> paired_with name (mutual)
  const allNames = new Set();

  const boxes = Object.keys(cardNames).filter(k => k !== 'all_total');

  for (const box of boxes) {
    const sections = Object.entries(cardNames[box]).filter(([k]) => k !== 'Card Count');
    for (const [, cards] of sections) {
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        allNames.add(card.name);

        if (card.group) {
          for (const member of card.group) {
            allNames.add(member);
            parentMap[member] = card.name;
          }
        }

        if (card.chain) {
          allNames.add(card.name);
          for (const member of card.chain) allNames.add(member);
          const fullChain = [card.name, ...card.chain];
          for (const member of fullChain) {
            chainMap[member] = fullChain.filter(m => m !== member);
            parentMap[member] = card.name;
          }
        }

        if (card.paired_with) {
          allNames.add(card.paired_with);
          pairedMap[card.name] = card.paired_with;
          pairedMap[card.paired_with] = card.name;
        }
      }
    }
  }

  return { parentMap, chainMap, pairedMap, allNames };
}

const BASE_CARDS = new Set(['Copper', 'Silver', 'Gold', 'Estate', 'Duchy', 'Province']);

function computeDepen(cardName, text, { parentMap, chainMap, pairedMap, allNames }) {
  console.log(`[DEPEN] ${cardName} | allNames size: ${allNames.size}`);
  const dependencies = new Set();
  const parent = [];

  // Parent
  if (parentMap[cardName]) parent.push(parentMap[cardName]);

  // Chain dependencies (mutual)
  if (chainMap[cardName]) {
    for (const mate of chainMap[cardName]) dependencies.add(mate);
  }

  // Paired_with (mutual)
  if (pairedMap[cardName]) dependencies.add(pairedMap[cardName]);

  // Text scan: named cards
  for (const name of allNames) {
    if (name === cardName) continue;
    if (BASE_CARDS.has(name)) continue;
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(text)) dependencies.add(name);
  }

  // Text scan: tokens
  for (const token of TOKENS) {
    const pattern = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (pattern.test(text)) dependencies.add(token);
  }

  return {
    dependencies: [...dependencies].sort(),
    parent,
  };
}

function main() {
  const { parentMap, chainMap, pairedMap, allNames } = buildStructure();
  const parsedTextDir = path.join(__dirname, '..', 'parsed_text');
  const boxes = Object.keys(cardNames).filter(k => k !== 'all_total');

  for (const box of boxes) {
    const filePath = path.join(parsedTextDir, `${box}.json`);
    if (!fs.existsSync(filePath)) continue;

    const cards = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    for (const card of cards) {
      const { dependencies, parent } = computeDepen(card.name, card.text || '', { parentMap, chainMap, pairedMap, allNames });
      card.dependencies = dependencies;
      card.parent = parent;
    }

    fs.writeFileSync(filePath, JSON.stringify(cards, null, 2), 'utf-8');
    console.log(`[SAVED] parsed_text/${box}.json`);
  }
}

module.exports = { computeDepen, buildStructure };
main();
