// fetch_all_images.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const cardNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'storage/card_names.json'), 'utf-8'));

function buildCardLookup() {
    const lookup = {};
    const boxes = Object.keys(cardNames).filter(k => k !== 'all_total');
    boxes.forEach((boxName, boxIdx) => {
        const boxNum = String(boxIdx + 1).padStart(2, '0');
        const box = cardNames[boxName];
        const hasRemoved = !!box.Removed;
        const allSections = Object.entries(box).filter(([k]) => k !== 'Card Count');
        let position = 1;
        for (const [, cards] of allSections) {
            if (!Array.isArray(cards)) continue;
            for (const card of cards) {
                lookup[card.name] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition: !hasRemoved ? '10' : '11' };
                if (card.group && Array.isArray(card.group)) {
                    for (const sub of card.group) {
                        position++;
                        lookup[sub] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition: !hasRemoved ? '10' : '11' };
                    }
                }
                if (card.paired_with) {
                    position++;
                    lookup[card.paired_with] = { boxName, boxNum, position: String(position).padStart(2, '0'), edition: !hasRemoved ? '10' : '11' };
                }
                position++;
            }
        }
    });
    return lookup;
}

function buildEditionLookup() {
    const editionLookup = {};
    const parsedTextDir = path.join(__dirname, '..', 'parsed_text');
    for (const file of fs.readdirSync(parsedTextDir)) {
        if (!file.endsWith('.json')) continue;
        const cards = JSON.parse(fs.readFileSync(path.join(parsedTextDir, file), 'utf-8'));
        for (const card of cards) {
            if (card.id) editionLookup[card.name] = card.id;
        }
    }
    return editionLookup;
}

function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', reject);
    });
}

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html'
            }
        };
        https.get(url, options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function fetchImage(cardName, info, editionLookup) {
    const { boxName, boxNum, position, edition } = info;
    const safeName = cardName.replace(/ /g, '_');
    const filename = `${safeName}.jpg`;

    const outDir = path.join(__dirname, '..', 'images', boxName);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const destPath = path.join(outDir, filename);
    if (fs.existsSync(destPath)) {
        //console.log(`[SKIP] ${cardName}`);
        return true;
    }

    const mediaUrl = `https://wiki.dominionstrategy.com/index.php/File:${safeName}.jpg`;
    const html = await fetchHtml(mediaUrl);
    const match = html.match(/og:image" content="([^"]+\.jpg)"/) ||
        html.match(/href="(\/images\/[^"]+\.jpg)"/);
    if (!match) return false;

    const directUrl = match[1].startsWith('http')
        ? match[1].replace('http://', 'https://')
        : `https://wiki.dominionstrategy.com${match[1]}`;
    await downloadImage(directUrl, destPath);
    //console.log(`[DONE] ${cardName} → images/${boxName}/${filename}`);
    return true;
}

const ICONS = {
    'Coin0': 'https://wiki.dominionstrategy.com/images/thumb/5/5d/Coin0.png/24px-Coin0.png',
    'Coin1': 'https://wiki.dominionstrategy.com/images/thumb/f/f7/Coin1.png/24px-Coin1.png',
    'Coin2': 'https://wiki.dominionstrategy.com/images/thumb/3/3d/Coin2.png/24px-Coin2.png',
    'Coin3': 'https://wiki.dominionstrategy.com/images/thumb/3/32/Coin3.png/24px-Coin3.png',
    'Coin4': 'https://wiki.dominionstrategy.com/images/thumb/2/2a/Coin4.png/24px-Coin4.png',
    'Coin5': 'https://wiki.dominionstrategy.com/images/thumb/7/7d/Coin5.png/24px-Coin5.png',
    'Coin6': 'https://wiki.dominionstrategy.com/images/thumb/6/6f/Coin6.png/24px-Coin6.png',
    'Coin7': 'https://wiki.dominionstrategy.com/images/thumb/b/bc/Coin7.png/24px-Coin7.png',
    'Coin8': 'https://wiki.dominionstrategy.com/images/thumb/4/47/Coin8.png/24px-Coin8.png',
    'Coin9': 'https://wiki.dominionstrategy.com/images/thumb/9/9d/Coin9.png/24px-Coin9.png',
    'Coin10': 'https://wiki.dominionstrategy.com/images/thumb/c/cc/Coin10.png/24px-Coin10.png',
    'Coin11': 'https://wiki.dominionstrategy.com/images/thumb/d/df/Coin11.png/24px-Coin11.png',
    'Coin14': 'https://wiki.dominionstrategy.com/images/thumb/0/02/Coin14.png/24px-Coin14.png',
    'Coin': 'https://wiki.dominionstrategy.com/images/thumb/6/6d/Coin.png/24px-Coin.png',
    'Coin2plus': 'https://wiki.dominionstrategy.com/images/thumb/7/79/Coin2plus.png/24px-Coin2plus.png',
    'Coin3plus': 'https://wiki.dominionstrategy.com/images/thumb/1/16/Coin3plus.png/24px-Coin3plus.png',
    'Coin0star': 'https://wiki.dominionstrategy.com/images/thumb/a/ae/Coin0star.png/24px-Coin0star.png',
    'Coin2star': 'https://wiki.dominionstrategy.com/images/thumb/0/00/Coin2star.png/24px-Coin2star.png',
    'Coin3star': 'https://wiki.dominionstrategy.com/images/thumb/a/a9/Coin3star.png/24px-Coin3star.png',
    'Coin4star': 'https://wiki.dominionstrategy.com/images/thumb/5/54/Coin4star.png/24px-Coin4star.png',
    'Coin5star': 'https://wiki.dominionstrategy.com/images/thumb/8/86/Coin5star.png/24px-Coin5star.png',
    'Coin6star': 'https://wiki.dominionstrategy.com/images/thumb/6/60/Coin6star.png/24px-Coin6star.png',
    'Coin7star': 'https://wiki.dominionstrategy.com/images/thumb/f/fa/Coin7star.png/24px-Coin7star.png',
    'Potion': 'https://wiki.dominionstrategy.com/images/thumb/7/7a/Potion.png/15px-Potion.png',
    'Debt': 'https://wiki.dominionstrategy.com/images/thumb/8/81/Debt.png/27px-Debt.png',
    'Debt1': 'https://wiki.dominionstrategy.com/images/thumb/4/43/Debt1.png/27px-Debt1.png',
    'Debt2': 'https://wiki.dominionstrategy.com/images/thumb/c/c6/Debt2.png/27px-Debt2.png',
    'Debt3': 'https://wiki.dominionstrategy.com/images/thumb/f/f5/Debt3.png/27px-Debt3.png',
    'Debt4': 'https://wiki.dominionstrategy.com/images/thumb/9/90/Debt4.png/27px-Debt4.png',
    'Debt5': 'https://wiki.dominionstrategy.com/images/thumb/2/21/Debt5.png/27px-Debt5.png',
    'Debt6': 'https://wiki.dominionstrategy.com/images/thumb/1/17/Debt6.png/27px-Debt6.png',
    'Debt8': 'https://wiki.dominionstrategy.com/images/thumb/d/d4/Debt8.png/27px-Debt8.png',
    'Debt40': 'https://wiki.dominionstrategy.com/images/thumb/9/98/Debt40.png/27px-Debt40.png',
    'VP': 'https://wiki.dominionstrategy.com/images/thumb/9/92/VP.png/21px-VP.png',
};

async function fetchIcons() {
    const outDir = path.join(__dirname, '..', 'images', 'icons');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    for (const [name, url] of Object.entries(ICONS)) {
        const destPath = path.join(outDir, `${name}.png`);
        if (fs.existsSync(destPath)) {
            console.log(`[SKIP] ${name}`);
            continue;
        }
        try {
            await downloadImage(url, destPath);
            console.log(`[DONE] ${name}`);
        } catch (err) {
            console.error(`[FAIL] ${name} - ${err.message}`);
        }
    }
}

async function main() {
    const lookup = buildCardLookup();
    const editionLookup = buildEditionLookup();
    const failed = [];

    const arg = process.argv[2];

    if (arg === 'icons') {
        await fetchIcons();
        return;
    }

    let currentBox = null;
    for (const [cardName, info] of Object.entries(lookup)) {
        if (info.boxName !== currentBox) {
            currentBox = info.boxName;
            console.log(`\n[BOX] ${currentBox}`);
        }
        try {
            const success = await fetchImage(cardName, info, editionLookup);
            if (!success) {
                const id = editionLookup[cardName] || `${boxNum}${position}${total}`;
                console.error(`[FAIL] ${cardName} (${id}) — could not find image URL`);
                failed.push(`${cardName} (${id})`);
            }
        } catch (err) {
            const id = editionLookup[cardName] || `${info.boxNum}10${info.position}`;
            console.error(`[FAIL] ${cardName} (${id}) — ${err.message}`);
            failed.push(`${cardName} (${id})`);
        }
    }

    if (failed.length > 0) {
        console.log(`\nFailed cards (${failed.length}):`);
        for (const name of failed) console.log(`  - ${name}`);
    } else {
        console.log('\nAll images fetched successfully!');
    }
}

main();
