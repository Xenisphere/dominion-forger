// test_api.js
const https = require('https');

function fetchWikitext(cardName) {
  return new Promise((resolve, reject) => {
    const url = `https://wiki.dominionstrategy.com/api.php?action=parse&page=${encodeURIComponent(cardName)}&prop=wikitext&format=json`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    };
    https.get(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const raw = await fetchWikitext('Smithy');
  const parsed = JSON.parse(raw);
  const wikitext = parsed?.parse?.wikitext?.['*'] || '';
  console.log(wikitext.slice(0, 500));
}

main();
