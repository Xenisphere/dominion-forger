// js/pages/kingdoms.js
function kingdomsPage(main) {
  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'Saved Kingdoms';

  const rule = document.createElement('hr');
  rule.className = 'page-rule';

  const p = document.createElement('p');
  p.className = 'page-body';
  p.textContent = 'Your recorded kingdoms, kept in parchment.';

  main.appendChild(h1);
  main.appendChild(rule);
  main.appendChild(p);
}
