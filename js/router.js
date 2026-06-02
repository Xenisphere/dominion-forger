// js/router.js
document.addEventListener('DOMContentLoaded', () => {

  const ROUTES = {
    '':           { label: 'Home',             page: homePage },
    'randomizer': { label: 'Randomizer',       page: randomizerPage },
    'browse':     { label: 'Browse Cards',     page: browsePage },
    'card':       { label: 'Card Page',        page: cardPage },
    'expansions': { label: 'Owned Expansions', page: expansionsPage },
    'kingdoms':   { label: 'Saved Kingdoms',   page: kingdomsPage },
    'statistics': { label: 'Statistics',       page: statisticsPage },
    'about':      { label: 'About',            page: aboutPage },
  };

  const main         = document.getElementById('main');
  const drawerLinks  = document.getElementById('drawer-links');
  const drawer       = document.getElementById('drawer');
  const overlay      = document.getElementById('drawer-overlay');
  const hamburger    = document.getElementById('hamburger');
  const drawerClose  = document.getElementById('drawer-close');

  // Build drawer nav links
  Object.entries(ROUTES).forEach(([key, { label }]) => {
    const a = document.createElement('a');
    a.href = key === '' ? '/dominion-forger/' : `/dominion-forger/${key}`;
    a.textContent = label;
    a.dataset.route = key;
    a.addEventListener('click', e => {
      e.preventDefault();
      closeDrawer();
      navigateTo(key);
      history.pushState({}, '', a.href);
    });
    drawerLinks.appendChild(a);
  });

  // Drawer open/close
  function openDrawer()  { drawer.classList.add('open'); overlay.classList.add('open'); }
  function closeDrawer() { drawer.classList.remove('open'); overlay.classList.remove('open'); }
  hamburger.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  // Routing
  function currentRoute() {
    // Support both hash-based (from 404 redirect) and path-based
    const hash = location.hash.replace('#/', '').replace('#', '');
    const path = location.pathname.replace('/dominion-forger/', '').replace('/dominion-forger', '');
    const key  = hash || path || '';
    return ROUTES[key] ? key : '';
  }

  function navigateTo(key) {
    // Update active link
    drawerLinks.querySelectorAll('a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === key);
    });
    document.title = key === ''
      ? 'Dominion Forger'
      : `${ROUTES[key].label} — Dominion Forger`;
    main.innerHTML = '';
    ROUTES[key].page(main);
    // Clear hash if present after redirect
    if (location.hash) history.replaceState({}, '', location.pathname);
  }

  // Handle browser back/forward
  window.addEventListener('popstate', () => navigateTo(currentRoute()));

  // Initial load
  navigateTo(currentRoute());
});
