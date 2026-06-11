// js/render.js

const BASE = location.hostname === 'localhost' ? '' : '/dominion-forger';

// Populated once on load from card_names.json
window.cardNameToExpansion = null;

async function loadCardData() {
    if (window.cardNameToExpansion) return;
    const res = await fetch(`${BASE}/storage/card_names.json`);
    const cardNames = await res.json();
    const map = {};
    for (const [expansion, box] of Object.entries(cardNames)) {
        if (expansion === 'all_total') continue;
        for (const [section, cards] of Object.entries(box)) {
            if (section === 'Card Count' || !Array.isArray(cards)) continue;
            for (const card of cards) {
                map[card.name] = expansion;
                if (card.group) card.group.forEach(m => map[m] = expansion);
                if (card.paired_with) map[card.paired_with] = expansion;
                if (card.chain) card.chain.forEach(m => map[m] = expansion);
            }
        }
    }
    window.cardNameToExpansion = map;
}

function iconImg(filename, alt) {
    const img = document.createElement('img');
    img.src = `${BASE}/images/card_icons/${filename}`;
    img.alt = alt;
    img.className = 'render-icon';
    return img;
}

function cardImg(cardName, expansion) {
    const safeName = cardName.replace(/ /g, '_');
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'render-card-link';
    a.addEventListener('click', e => {
        e.preventDefault();
        navigateTo('card', true, { name: cardName });
    });
    const img = document.createElement('img');
    img.src = `${BASE}/images/expansions/${expansion}/${safeName}.jpg`;
    img.alt = cardName;
    img.className = 'render-card-img';
    a.appendChild(img);
    return a;
}

// Tokenize text into segments: plain text, card refs, icons, line breaks
function tokenize(text) {
    // Order matters - more specific patterns first
    const pattern = /([A-Za-z_]+\.jpg)|\+\((\d+)\)|\((\d+)\)\+|\((\d+)\*\)|\((\d+)\)|\<(\d+)\>|\[1\]|\{(\d+)\}|\(_\)|\<_\>|\|/g;
    const tokens = [];
    let last = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) {
            tokens.push({ type: 'text', value: text.slice(last, match.index) });
        }

        const [full, cardFile, coinPlus, coinPlusEnd, coinStar, coin, debt, vp] = match;

        if (cardFile) {
            tokens.push({ type: 'card', value: cardFile });
        } else if (coinPlus !== undefined) {
            tokens.push({ type: 'coin-plus', value: coinPlus });
        } else if (coinPlusEnd !== undefined) {
            tokens.push({ type: 'coinplus', value: coinPlusEnd });
        } else if (coinStar !== undefined) {
            tokens.push({ type: 'coinstar', value: coinStar });
        } else if (coin !== undefined) {
            tokens.push({ type: 'coin', value: coin });
        } else if (debt !== undefined) {
            tokens.push({ type: 'debt', value: debt });
        } else if (full === '[1]') {
            tokens.push({ type: 'potion' });
        } else if (vp !== undefined) {
            tokens.push({ type: 'vp', value: vp });
        } else if (full === '(_)') {
            tokens.push({ type: 'coin-blank' });
        } else if (full === '<_>') {
            tokens.push({ type: 'debt-blank' });
        } else if (full === '|') {
            tokens.push({ type: 'br' });
        }

        last = match.index + full.length;
    }

    if (last < text.length) {
        tokens.push({ type: 'text', value: text.slice(last) });
    }

    return tokens;
}

// Render card text into a container element
async function renderCardText(text, container, excludeName = null) {
    await loadCardData();
    const tokens = tokenize(text);

    for (const token of tokens) {
        switch (token.type) {
            case 'text': {
                container.appendChild(document.createTextNode(token.value));
                break;
            }
            case 'card': {
                // e.g. Counting_House.jpg -> card name is Counting House
                const cardName = token.value.replace('.jpg', '').replace(/_/g, ' ');
                const expansion = window.cardNameToExpansion[cardName];
                if (expansion && cardName !== excludeName) {
                    container.appendChild(cardImg(cardName, expansion));
                } else {
                    // Fallback: show as text if card not found
                    container.appendChild(document.createTextNode(cardName));
                }
                break;
            }
            case 'coin-plus': {
                // +(N) -> + text then CoinN.png
                container.appendChild(document.createTextNode('+'));
                container.appendChild(iconImg(`Coin${token.value}.png`, `(${token.value})`));
                break;
            }
            case 'coinplus': {
                container.appendChild(iconImg(`Coin${token.value}plus.png`, `(${token.value})+`));
                break;
            }
            case 'coinstar': {
                container.appendChild(iconImg(`Coin${token.value}star.png`, `(${token.value}*)`));
                break;
            }
            case 'coin': {
                container.appendChild(iconImg(`Coin${token.value}.png`, `(${token.value})`));
                break;
            }
            case 'debt': {
                container.appendChild(iconImg(`Debt${token.value}.png`, `<${token.value}>`));
                break;
            }
            case 'potion': {
                container.appendChild(iconImg('Potion.png', '[1]'));
                break;
            }
            case 'vp': {
                container.appendChild(iconImg('VP.png', `{${token.value}}`));
                break;
            }
            case 'coin-blank': {
                container.appendChild(iconImg('Coin.png', '(?)'));
                break;
            }
            case 'debt-blank': {
                container.appendChild(iconImg('Debt.png', '<?>'));
                break;
            }
            case 'br': {
                container.appendChild(document.createElement('br'));
                break;
            }
        }
    }
}