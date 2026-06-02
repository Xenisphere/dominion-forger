// js/pages/randomizer.js
function randomizerPage(main) {
  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'Randomizer';

  const rule = document.createElement('hr');
  rule.className = 'page-rule';

  const p = document.createElement('p');
  p.className = 'page-body';
  p.textContent = 'Summon a random kingdom from your collection.';

  main.appendChild(h1);
  main.appendChild(rule);
  main.appendChild(p);
}
