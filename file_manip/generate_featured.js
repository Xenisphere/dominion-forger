// generate_featured.js
const fs = require('fs');
const path = require('path');

const cardNamesPath    = path.join(__dirname, '..', 'storage', 'card_names.json');
const poolPath         = path.join(__dirname, '..', 'storage', 'featured_pool.json');
const historyPath      = path.join(__dirname, '..', 'storage', 'featured_history.json');

const EXCLUDED = new Set([
  // Base cards
  'Copper', 'Silver', 'Gold', 'Estate', 'Duchy', 'Province',
  // Extra base
  'Curse', 'Platinum', 'Colony', 'Potion',
  // Ruins group members
  'Abandoned Mine', 'Ruined Library', 'Ruined Market', 'Ruined Village', 'Survivors',
]);

// Exclude group pile names that aren't real cards
const EXCLUDED_GROUPS = new Set(['Ruins']);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPool() {
  const cardNames = JSON.parse(fs.readFileSync(cardNamesPath, 'utf-8'));
  const pool = [];

  for (const [expansion, box] of Object.entries(cardNames)) {
    if (expansion === 'all_total') continue;
    for (const [section, cards] of Object.entries(box)) {
      if (section === 'Card Count' || !Array.isArray(cards)) continue;
      for (const card of cards) {
        if (!EXCLUDED.has(card.name) && !EXCLUDED_GROUPS.has(card.name)) {
          pool.push(card.name);
        }
        // Include group members except Ruins
        if (card.group && !EXCLUDED_GROUPS.has(card.name)) {
          for (const member of card.group) {
            if (!EXCLUDED.has(member)) pool.push(member);
          }
        }
        // Include paired_with and chain
        if (card.paired_with && !EXCLUDED.has(card.paired_with)) {
          pool.push(card.paired_with);
        }
        if (card.chain) {
          for (const member of card.chain) {
            if (!EXCLUDED.has(member)) pool.push(member);
          }
        }
      }
    }
  }

  return shuffle(pool);
}

function main() {
  // Load or init history
  const history = fs.existsSync(historyPath)
    ? JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
    : [];

  // Load or init pool — reshuffle if empty
  let pool = fs.existsSync(poolPath)
    ? JSON.parse(fs.readFileSync(poolPath, 'utf-8'))
    : [];

  if (pool.length === 0) {
    console.log('[INFO] Pool empty — rebuilding and reshuffling');
    pool = buildPool();
  }

  // Pop first card
  const card = pool.shift();
  const date = new Date().toISOString().slice(0, 10);

  history.push({ date, name: card });
  console.log(`[FEATURED] ${date} - ${card}`);

  fs.writeFileSync(poolPath,    JSON.stringify(pool,    null, 2), 'utf-8');
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
}

main();

