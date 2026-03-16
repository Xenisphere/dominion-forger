// Node.js script to fetch a Dominion card from WikiMedia API and write to cards.json

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // npm install node-fetch@2 for Node 18

const cardsFilePath = path.join(__dirname, 'cards.json');

// Function to load existing cards
function loadCards() {
  if (fs.existsSync(cardsFilePath)) {
    const data = fs.readFileSync(cardsFilePath, 'utf-8');
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('[ERROR] Failed to parse cards.json, starting fresh.');
      return [];
    }
  } else {
    return [];
  }
}

// Function to save cards
function saveCards(cards) {
  fs.writeFileSync(cardsFilePath, JSON.stringify(cards, null, 2), 'utf-8');
  console.log(`[DEBUG] Saved ${cards.length} cards to cards.json`);
}

// Function to fetch card info from WikiMedia API
async function fetchCard(cardName) {
  console.log(`[DEBUG] Searching for "${cardName}" on WikiMedia API`);

  // Query for page content
  const url = `https://en.dominion.wikia.com/api.php?action=parse&page=${encodeURIComponent(cardName)}&prop=wikitext&format=json`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json.parse || !json.parse.wikitext) {
      console.error('[ERROR] Card page not found or invalid format');
      return null;
    }

    const wikitext = json.parse.wikitext['*'];

    // Simple parsing: try to find relevant fields
    const kingdomMatch = wikitext.match(/\|\s*Expansion\s*=\s*(.+)/i);
    const costMatch = wikitext.match(/\|\s*Cost\s*=\s*(.+)/i);
    const typesMatch = wikitext.match(/\|\s*Type\s*=\s*(.+)/i);
    const textMatch = wikitext.match(/\|\s*Text\s*=\s*(.+)/i);

    const cardData = {
      name: cardName,
      kingdom: kingdomMatch ? kingdomMatch[1].trim() : 'Unknown',
      cost: costMatch ? costMatch[1].trim() : 'Unknown',
      types: typesMatch ? typesMatch[1].split(',').map(t => t.trim()) : [],
      text: textMatch ? textMatch[1].trim() : ''
    };

    console.log('[DEBUG] Parsed card:', cardData);
    return cardData;

  } catch (err) {
    console.error('[ERROR] Failed to fetch card:', err);
    return null;
  }
}

// Main function
async function main() {
  const cardName = process.argv[2]; // e.g., "Village"
  if (!cardName) {
    console.error('Usage: node fetch_card_wiki.js "Card Name"');
    process.exit(1);
  }

  const card = await fetchCard(cardName);
  if (!card) return;

  const cards = loadCards();
  // Avoid duplicates
  if (cards.some(c => c.name === card.name)) {
    console.log(`[DEBUG] Card "${card.name}" already exists in cards.json`);
    return;
  }

  cards.push(card);
  saveCards(cards);
}

main();
