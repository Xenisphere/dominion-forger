// fetch_card_wiki.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cardsFilePath = path.join(__dirname, 'cards.json');

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

function saveCards(cards) {
  fs.writeFileSync(cardsFilePath, JSON.stringify(cards, null, 2), 'utf-8');
  console.log(`[DEBUG] Saved ${cards.length} cards to cards.json`);
}

async function fetchCard(cardName) {
  console.log(`[DEBUG] Searching for "${cardName}" on wiki API`);
const url = `https://wiki.dominionstrategy.com/api.php?action=parse&page=${encodeURIComponent(cardName)}&prop=wikitext&format=json&origin=*`;
  let data;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://wiki.dominionstrategy.com/',
      },
      redirect: 'follow'
    });
    data = await res.text();
  } catch (err) {
    console.error('[ERROR] HTTPS request failed:', err);
    return null;
  }

  try {
    const json = JSON.parse(data);
    if (!json.parse || !json.parse.wikitext || !json.parse.wikitext['*']) {
      console.error('[ERROR] Card page not found or invalid format');
      return null;
    }

    const wikitext = json.parse.wikitext['*'];

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
    console.error('[ERROR] Failed to parse JSON:', err);
    console.error('[DEBUG] Response preview:', data.slice(0, 200));
    return null;
  }
}

async function main() {
  const cardName = process.argv[2];
  if (!cardName) {
    console.error('Usage: node fetch_card_wiki.js "Card Name"');
    process.exit(1);
  }

  const card = await fetchCard(cardName);
  if (!card) return;

  const cards = loadCards();
  if (cards.some(c => c.name === card.name)) {
    console.log(`[DEBUG] Card "${card.name}" already exists in cards.json`);
    return;
  }

  cards.push(card);
  saveCards(cards);
}

main();
