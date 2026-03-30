// fix_raw.js
const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, 'card_names_raw.json'), 'utf-8');
const fixed = raw.replace(/\t/g, '\\t');
fs.writeFileSync(path.join(__dirname, 'card_names_raw.json'), fixed, 'utf-8');
console.log('Fixed tabs in card_names_raw.json');
