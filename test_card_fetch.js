// test_card_fetch.js
// Node-friendly Dominion card test loader with debugging

const fs = require('fs');
const path = require('path');

// Path to your card file
const cardFilePath = path.join(__dirname, 'cards.json');

console.log("[DEBUG] Starting test_card_fetch.js");

// Check if the file exists
if (!fs.existsSync(cardFilePath)) {
  console.error(`[ERROR] File not found: ${cardFilePath}`);
  process.exit(1);
}

console.log(`[DEBUG] Found cards.json at: ${cardFilePath}`);

// Read the file asynchronously
fs.readFile(cardFilePath, 'utf-8', (err, data) => {
  if (err) {
    console.error("[ERROR] Failed to read the file:", err);
    return;
  }

  console.log("[DEBUG] File read successfully, parsing JSON...");

  try {
    const cards = JSON.parse(data);
    console.log("[DEBUG] JSON parsed successfully!");

    if (!Array.isArray(cards)) {
      console.error("[ERROR] JSON is not an array of cards!");
      return;
    }

    // Show first 5 cards for debugging
    console.log("[DEBUG] First 5 cards:");
    console.log(cards.slice(0, 5));

    console.log(`[DEBUG] Total cards loaded: ${cards.length}`);

    // Optional: simple synergy debug example
    console.log("[DEBUG] Checking for simple engine synergies (Village + Draw)...");

    const villages = cards.filter(c => c.tags?.includes("village"));
    const draws = cards.filter(c => c.tags?.includes("draw"));

    console.log(`[DEBUG] Villages found: ${villages.map(c => c.name).join(", ")}`);
    console.log(`[DEBUG] Draw cards found: ${draws.map(c => c.name).join(", ")}`);

  } catch (parseErr) {
    console.error("[ERROR] Failed to parse JSON:", parseErr.message);
  }
});

console.log("[DEBUG] Finished initiating file read (async)");
