// js/router.js
document.addEventListener('DOMContentLoaded', () => {

    const ROUTES = {
        '': { label: 'Home', page: homePage },
        'randomizer': { label: 'Randomizer', page: randomizerPage },
        'browse': { label: 'Browse Cards', page: browsePage },
        'search': { label: 'Search', page: searchPage },
        'card': { label: 'Card Page', page: cardPage },
        'expansions': { label: 'Owned Expansions', page: expansionsPage },
        'kingdoms': { label: 'Saved Kingdoms', page: kingdomsPage },
        'statistics': { label: 'Statistics', page: statisticsPage },
        'help': { label: 'Help', page: helpPage },
        'feedback': { label: 'Feedback', page: feedbackPage },
        'about': { label: 'About', page: aboutPage },
    };

    const BASE = location.hostname === 'localhost' ? '' : '/dominion-forger';
    const main = document.getElementById('main');
    const drawerLinks = document.getElementById('drawer-links');
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    const hamburger = document.getElementById('hamburger');
    const drawerClose = document.getElementById('drawer-close');
    const drawerFooterLinks = document.getElementById('drawer-footer-links');
    const FOOTER_ROUTES = new Set(['help', 'feedback', 'about']);

    Object.entries(ROUTES).forEach(([key, { label }]) => {
        const a = document.createElement('a');
        a.href = key === '' ? `${BASE}/` : `${BASE}/${key}`;
        a.textContent = label;
        a.dataset.route = key;
        a.addEventListener('click', e => {
            e.preventDefault();
            closeDrawer();
            navigateTo(key, true);
        });
        if (FOOTER_ROUTES.has(key)) drawerFooterLinks.appendChild(a);
        else drawerLinks.appendChild(a);
    });

    const spacer = document.createElement('div');
    spacer.style.height = '1rem';
    drawerFooterLinks.appendChild(spacer);

    //Head

    document.querySelector('header .site-title').addEventListener('click', e => {
        e.preventDefault();
        navigateTo('', true);
    });

    // Drawer
    function openDrawer() { drawer.classList.add('open'); overlay.classList.add('open'); }
    function closeDrawer() { drawer.classList.remove('open'); overlay.classList.remove('open'); }
    hamburger.addEventListener('click', openDrawer);
    drawerClose.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    //Search Bar
    document
    document.getElementById('header-search').addEventListener('submit', e => {
        e.preventDefault();
        const value = document.getElementById('search-input').value.trim();
        if (!value) return;
        navigateTo('search', true, { q: value });
    });

    // Determine route from hash (404 redirect), path, or sessionStorage
    function currentRoute() {
        const hash = location.hash.replace('#/', '').replace('#', '');
        if (hash && ROUTES[hash] !== undefined) return hash;
        const path = location.pathname.replace(BASE, '').replace(/^\//, '').replace(/\/$/, '');
        if (path && ROUTES[path] !== undefined) return path;
        return sessionStorage.getItem('df_route') || '';
    }

    function navigateTo(key, push = false, params = {}) {
        const baseKey = key.split('?')[0];
        if (ROUTES[baseKey] === undefined) key = '';
        drawerLinks.querySelectorAll('a').forEach(a => {
            a.classList.toggle('active', a.dataset.route === baseKey);
        });
        document.title = baseKey === '' ? 'Dominion Forger' : `${ROUTES[baseKey].label} — Dominion Forger`;
        sessionStorage.setItem('df_route', baseKey);
        const cleanUrl = baseKey === '' ? `${BASE}/` : `${BASE}/${baseKey}`;
        if (push) history.pushState({ route: baseKey }, '', cleanUrl);
        else history.replaceState({ route: baseKey }, '', cleanUrl);
        main.innerHTML = '';
        ROUTES[baseKey].page(main, params);
        window.scrollTo(0, 0);
    }

    window.addEventListener('popstate', e => {
        const key = e.state?.route ?? currentRoute();
        navigateTo(key, false);
    });

    window.navigateTo = navigateTo;

    navigateTo(currentRoute(), false);
});
