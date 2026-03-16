// fetch_card_wiki.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const cardsFilePath = path.join(__dirname, 'cards.json');

// Load existing cards from JSON
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

// Save cards to JSON
function saveCards(cards) {
  fs.writeFileSync(cardsFilePath, JSON.stringify(cards, null, 2), 'utf-8');
  console.log(`[DEBUG] Saved ${cards.length} cards to cards.json`);
}

// Fetch a single card from Dominion Strategy wiki
async function fetchCard(cardName) {
  console.log(`[DEBUG] Searching for "${cardName}" on Dominion Strategy wiki`);

const url = `https://wiki.dominionstrategy.com/api.php?action=parse&page=${encodeURIComponent(cardName)}&prop=wikitext&format=json`;  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          if (!json.parse || !json.parse.wikitext || !json.parse.wikitext['*']) {
            console.error('[ERROR] Card page not found or invalid format');
            resolve(null);
            return;
          }

          const wikitext = json.parse.wikitext['*'];

          // Parse fields using regex
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
          resolve(cardData);

        } catch (err) {
          console.error('[ERROR] Failed to parse JSON:', err);
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.error('[ERROR] HTTPS request failed:', err);
      resolve(null);
    });
  });
}

// Main function
async function main() {
  const cardName = process.argv[2];
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
