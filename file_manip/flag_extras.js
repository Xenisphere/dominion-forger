const fs = require('fs');
const path = require('path');

const cards = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards.json'), 'utf-8'));
const cardNames = new Set(cards.map(c => c.name.toLowerCase()));

const nonSupplyKeywords = [
  'bane', 'heirloom', 'loot', 'spoils', 'madman', 'mercenary',
  'will-o\'-wisp', 'imp', 'ghost', 'bat', 'horse', 'pouch',
  'cursed gold', 'magic lamp', 'haunted mirror', 'goat', 'pasture',
  'lucky coin', 'pixie', 'flag', 'key', 'treasure chest'
];

const setupPhrases = [
  'its pile', 'return to its pile', 'not in the supply',
  'bane card', 'costing', 'set aside', 'pile costing'
];

const flagged = [];

for (const card of cards) {
  // Skip cards that already have paired_with
  if (card.paired_with) continue;

  const text = (card.text || '').toLowerCase();
  const flags = [];

  // Check for non-supply keywords
  for (const kw of nonSupplyKeywords) {
    if (text.includes(kw)) flags.push(`keyword: "${kw}"`);
  }

  // Check for setup phrases
  for (const phrase of setupPhrases) {
    if (text.includes(phrase)) flags.push(`phrase: "${phrase}"`);
  }

  // Check if any other card name is mentioned in the text
  for (const name of cardNames) {
    if (name === card.name.toLowerCase()) continue;
    if (name.length < 4) continue; // skip short names to avoid false positives
    if (text.includes(name)) flags.push(`mentions card: "${name}"`);
  }

  if (flags.length > 0) {
    flagged.push({ name: card.name, kingdom: card.kingdom, flags });
  }
}

console.log(`\nFlagged ${flagged.length} cards:\n`);
for (const f of flagged) {
  console.log(`[${f.kingdom}] ${f.name}`);
  for (const flag of f.flags) console.log(`  - ${flag}`);
}

fs.writeFileSync(
  path.join(__dirname, 'flagged_extras.json'),
  JSON.stringify(flagged, null, 2),
  'utf-8'
);
console.log('\nSaved to flagged_extras.json');
