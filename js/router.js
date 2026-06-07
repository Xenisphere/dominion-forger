// js/router.js
document.addEventListener('DOMContentLoaded', () => {

  const ROUTES = {
      '': { label: 'Home', page: homePage },
      'randomizer': { label: 'Randomizer', page: randomizerPage },
      'browse': { label: 'Browse Cards', page: browsePage },
      'expansions': { label: 'Owned Expansions', page: expansionsPage },
      'kingdoms': { label: 'Saved Kingdoms', page: kingdomsPage },
      'statistics': { label: 'Statistics', page: statisticsPage },
      'help': { label: 'Help', page: helpPage },
      'feedback': { label: 'Feedback', page: feedbackPage },
      'about': { label: 'About', page: aboutPage },
  };

    const BASE = location.hostname === 'localhost' ? '' : '/dominion-forger';
    const main        = document.getElementById('main');
    const drawerLinks = document.getElementById('drawer-links');
    const drawer      = document.getElementById('drawer');
    const overlay     = document.getElementById('drawer-overlay');
    const hamburger   = document.getElementById('hamburger');
    const drawerClose = document.getElementById('drawer-close');
    const bottomPages = [
        'about',
        'help',
        'feedback'
    ];

  // Build drawer nav links
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
    drawerLinks.appendChild(a);
  });

  // Drawer
    function openDrawer() { drawer.classList.add('open'); overlay.classList.add('open'); }
    function closeDrawer() { drawer.classList.remove('open'); overlay.classList.remove('open'); }
    hamburger.addEventListener('click', openDrawer);
    drawerClose.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    //Search Bar
    document
        .getElementById('header-search')
        .addEventListener('submit', e => {

            e.preventDefault();

            const value =
                document
                    .getElementById('search-input')
                    .value
                    .trim();

            if (!value) return;

            navigateTo(`search?q=${encodeURIComponent(value)}`, true);

        });

  // Determine route from hash (404 redirect), path, or sessionStorage
  function currentRoute() {
    const hash = location.hash.replace('#/', '').replace('#', '');
    if (hash && ROUTES[hash] !== undefined) return hash;
    const path = location.pathname.replace(BASE, '').replace(/^\//, '').replace(/\/$/, '');
    if (path && ROUTES[path] !== undefined) return path;
    return sessionStorage.getItem('df_route') || '';
  }

  function navigateTo(key, push = false) {
    if (ROUTES[key] === undefined) key = '';

    // Update active link
    drawerLinks.querySelectorAll('a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === key);
    });

    document.title = key === '' ? 'Dominion Forger' : `${ROUTES[key].label} — Dominion Forger`;

    // Persist route and clean URL
    sessionStorage.setItem('df_route', key);
    const cleanUrl = key === '' ? `${BASE}/` : `${BASE}/${key}`;
    if (push) history.pushState({ route: key }, '', cleanUrl);
    else history.replaceState({ route: key }, '', cleanUrl);

    main.innerHTML = '';
    ROUTES[key].page(main);
  }

  window.addEventListener('popstate', e => {
    const key = e.state?.route ?? currentRoute();
    navigateTo(key, false);
  });

  navigateTo(currentRoute(), false);
});
