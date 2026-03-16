// test_card_fetch.js
// Node-friendly test loader for your Dominion card file

// Import Node's filesystem module
const fs = require('fs');
const path = require('path');

// Path to the JSON file
const cardFilePath = path.join(__dirname, 'cards.json');

console.log("[DEBUG] Starting test_card_fetch.js");

// Check if the file exists
if (!fs.existsSync(cardFilePath)) {
  console.error(`[ERROR] File not found: ${cardFilePath}`);
  process.exit(1); // Stop execution
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

    // Log the first few cards to check content
    console.log("[DEBUG] First 5 cards:");
    console.log(cards.slice(0, 5));

    console.log(`[DEBUG] Total cards loaded: ${cards.length}`);
  } catch (parseErr) {
    console.error("[ERROR] Failed to parse JSON:", parseErr.message);
  }
});

console.log("[DEBUG] Finished initiating file read (async)");
