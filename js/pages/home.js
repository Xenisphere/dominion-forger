// js/pages/home.js
async function homePage(main, params = {}) {

    // -- HERO --
    const hero = document.createElement('section');
    hero.className = 'hero';

    const title = document.createElement('h1');
    title.className = 'hero-title';
    title.textContent = 'Dominion Forger';

    const subtitle = document.createElement('p');
    subtitle.className = 'hero-subtitle';
    subtitle.textContent = 'Advanced Kingdom Builder, Card Database, and Statistics Tool';

    const buttons = document.createElement('div');
    buttons.className = 'hero-buttons';

    [['Randomizer', 'randomizer'], ['Browse Cards', 'browse']].forEach(([label, route]) => {
        const btn = document.createElement('a');
        btn.className = 'hero-btn';
        btn.href = '#';
        btn.textContent = label;
        btn.addEventListener('click', e => { e.preventDefault(); navigateTo(route, true); });
        buttons.appendChild(btn);
    });

    hero.appendChild(title);
    hero.appendChild(subtitle);
    hero.appendChild(buttons);
    main.appendChild(hero);

    // -- STATS --
    const statsSection = document.createElement('section');
    statsSection.className = 'home-section';

    const statsHeading = document.createElement('h2');
    statsHeading.className = 'home-section-heading';
    statsHeading.textContent = 'Community';
    statsSection.appendChild(statsHeading);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    const stats = [
        { label: 'Total Games Played', value: 'Placeholder' },
        { label: 'Most Played Card', value: 'Placeholder' },
        { label: 'Most Played Expansion', value: 'Placeholder' },
        { label: 'Cards Indexed', value: 'Placeholder' },
        { label: 'Top Rated Card', value: 'Placeholder' },
        { label: 'Most Saved Kingdom', value: 'Placeholder' },
    ];

    stats.forEach(({ label, value }) => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        const h3 = document.createElement('h3');
        h3.textContent = label;
        const val = document.createElement('div');
        val.className = 'stat-value';
        val.textContent = value;
        card.appendChild(h3);
        card.appendChild(val);
        statsGrid.appendChild(card);
    });

    statsSection.appendChild(statsGrid);
    main.appendChild(statsSection);

    // -- FEATURED CARD --
    const featSection = document.createElement('section');
    featSection.className = 'home-section';

    const featHeading = document.createElement('h2');
    featHeading.className = 'home-section-heading';
    featHeading.textContent = 'Featured Card';
    featSection.appendChild(featHeading);

    const panel = document.createElement('div');
    panel.className = 'feature-panel';
    panel.textContent = 'Loading...';
    featSection.appendChild(panel);
    main.appendChild(featSection);

    // Daily seed — consistent for the day
    function dailySeed() {
        const d = new Date();
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }

    function seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    function pickIndex(seed, length) {
        return Math.floor(seededRandom(seed) * length);
    }

    const BASE = location.hostname === 'localhost' ? '' : '/dominion-forger';

    fetch(`${BASE}/storage/card_names.json`)
        .then(r => r.json())
        .then(cardNames => {
            const expansions = Object.keys(cardNames).filter(k => k !== 'all_total');
            const seed = dailySeed();
            const expansion = expansions[pickIndex(seed, expansions.length)];
            const box = cardNames[expansion];

            // Flatten all card names in the expansion
            const allNames = [];
            Object.entries(box).forEach(([k, cards]) => {
                if (k === 'Card Count' || !Array.isArray(cards)) return;
                cards.forEach(card => {
                    allNames.push({ name: card.name, expansion });
                    if (card.group) card.group.forEach(m => allNames.push({ name: m, expansion }));
                    if (card.paired_with) allNames.push({ name: card.paired_with, expansion });
                    if (card.chain) card.chain.forEach(m => allNames.push({ name: m, expansion }));
                });
            });

            const picked = allNames[pickIndex(seed + 1, allNames.length)];
            return fetch(`${BASE}/parsed_text/${encodeURIComponent(expansion)}.json`)
                .then(r => r.json())
                .then(cards => ({ card: cards.find(c => c.name === picked.name), expansion }));
        })
        .then(async ({ card, expansion }) => {
            if (!card) { panel.textContent = 'Could not load featured card.'; return; }

            panel.textContent = '';

            const img = document.createElement('img');
            img.src = `${BASE}/${card.image}`;
            img.alt = card.name;
            img.className = 'featured-image';

            const info = document.createElement('div');
            info.className = 'featured-info';

            const name = document.createElement('h3');
            name.className = 'featured-name';
            name.textContent = card.name;

            const exp = document.createElement('p');
            exp.className = 'featured-expansion';
            exp.textContent = expansion;

            const cost = document.createElement('p');
            cost.className = 'featured-cost';
            cost.textContent = `Cost: ${card.cost ?? '—'}`;

            const types = document.createElement('p');
            types.className = 'featured-types';
            types.textContent = card.types?.join(' - ') ?? '';

            const text = document.createElement('p');
            text.className = 'featured-text';
            await renderCardText(card.text, text, card.name);

            const p = document.createElement('p');
            await renderCardText(card.text, p, card.name);

            const link = document.createElement('a');
            link.className = 'featured-link';
            link.href = '#';
            link.textContent = 'View Card';
            link.addEventListener('click', e => {
                e.preventDefault();
                navigateTo('card', true, { name: card.name });
            });

            info.appendChild(name);
            info.appendChild(exp);
            info.appendChild(cost);
            info.appendChild(types);
            info.appendChild(text);
            info.appendChild(link);

            panel.appendChild(img);
            panel.appendChild(info);
        })
        .catch(() => { panel.textContent = 'Could not load featured card.'; });
}