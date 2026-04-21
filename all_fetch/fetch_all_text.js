// fetch_all_text.js
const fs = require('fs');
const path = require('path');

async function main() {
  const cardNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'card_names.json'), 'utf-8'));
  const rawDir = path.join(__dirname, '..', 'raw');
  const textDir = path.join(__dirname, '..', 'text');
  if (!fs.existsSync(textDir)) fs.mkdirSync(textDir);

  const boxes = Object.keys(cardNames).filter(k => k !== 'all_total');
  const failed = [];

  for (const boxName of boxes) {
    const box = cardNames[boxName];
    const allSections = Object.entries(box).filter(([k]) => k !== 'Card Count');
    const boxCards = [];

    for (const [, cards] of allSections) {
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        const names = [card.name];
        if (card.group && Array.isArray(card.group)) names.push(...card.group);
        if (card.paired_with) names.push(card.paired_with);
        if (card.chain) names.push(...card.chain);

        for (const name of names) {
          const safeName = name.replace(/'/g, '%27');
          const localPath = path.join(rawDir, `${safeName}.json`);

          if (!fs.existsSync(localPath)) {
            console.error(`[FAIL] ${name} — no raw file found`);
            failed.push(name);
            continue;
          }

          const fileData = JSON.parse(fs.readFileSync(localPath, 'utf-8'));

          // Reassemble text fields
          const textFields = [];
          let i = 1;
          while (true) {
            const key = i === 1 ? 'text' : `text${i}`;
            if (!fileData[key]) break;
            textFields.push(fileData[key]);
            i++;
          }

          if (textFields.length === 0) {
            console.error(`[FAIL] ${name} — no text fields in raw file`);
            failed.push(name);
            continue;
          }

          boxCards.push({ name, text: textFields.join(' | ') });
          console.log(`[DONE] ${name}`);
        }
      }
    }

    const outPath = path.join(textDir, `${boxName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(boxCards, null, 2), 'utf-8');
    console.log(`[SAVED] text/${boxName}.json (${boxCards.length} cards)`);
  }

  if (failed.length > 0) {
    console.log(`\nFailed cards (${failed.length}):`);
    for (const name of failed) console.log(`  - ${name}`);
  } else {
    console.log('\nAll text fetched successfully!');
  }
}

main();
