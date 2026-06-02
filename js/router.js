document.addEventListener('DOMContentLoaded', () => {
  const ROUTES = {
    home:        { label: 'Home',             page: homePage },
    randomizer:  { label: 'Randomizer',       page: randomizerPage },
    browse:      { label: 'Browse Cards',     page: browsePage },
    card:        { label: 'Card Page',        page: cardPage },
    expansions:  { label: 'Owned Expansions', page: expansionsPage },
    kingdoms:    { label: 'Saved Kingdoms',   page: kingdomsPage },
    statistics:  { label: 'Statistics',       page: statisticsPage },
    about:       { label: 'About',            page: aboutPage },
  };

  const nav  = document.getElementById('nav');
  const main = document.getElementById('main');

  Object.entries(ROUTES).forEach(([key, { label }]) => {
    const a = document.createElement('a');
    a.href = `#${key}`;
    a.textContent = label;
    a.dataset.route = key;
    nav.appendChild(a);
  });

  function currentRoute() {
    const hash = location.hash.slice(1);
    return ROUTES[hash] ? hash : 'home';
  }

  function navigate() {
    const route = currentRoute();
    nav.querySelectorAll('a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === route);
    });
    document.title = `${ROUTES[route].label} — Dominion Forger`;
    main.innerHTML = '';
    ROUTES[route].page(main);
  }

  window.addEventListener('hashchange', navigate);
  navigate();
});
