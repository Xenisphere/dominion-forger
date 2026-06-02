// js/pages/browse.js
function browsePage(main) {
  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'Browse Cards';

  const rule = document.createElement('hr');
  rule.className = 'page-rule';

  const p = document.createElement('p');
  p.className = 'page-body';
  p.textContent = 'Peruse the full catalogue of cards.';

  main.appendChild(h1);
  main.appendChild(rule);
  main.appendChild(p);
}
