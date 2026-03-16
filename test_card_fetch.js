const fs = require('fs');
const path = require('path');

const cardFilePath = path.join(__dirname, 'cards.json');

console.log("[DEBUG] Starting test_card_fetch.js");

if (!fs.existsSync(cardFilePath)) {
  console.error(`[ERROR] File not found: ${cardFilePath}`);
  process.exit(1);
}

fs.readFile(cardFilePath, 'utf-8', (err, data) => {
  if (err) {
    console.error("[ERROR] Failed to read the file:", err);
    return;
  }

  try {
    const cards = JSON.parse(data);
    console.log("[DEBUG] JSON parsed successfully!");
    console.log(cards.slice(0, 5));
    console.log(`[DEBUG] Total cards loaded: ${cards.length}`);
  } catch (parseErr) {
    console.error("[ERROR] Failed to parse JSON:", parseErr.message);
  }
});

console.log("[DEBUG] Finished initiating file read (async)");
