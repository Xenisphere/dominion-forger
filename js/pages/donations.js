// js/pages/expansions.js
function donationsPage(main) {
  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'Donations';

  const rule = document.createElement('hr');
  rule.className = 'page-rule';

  const p = document.createElement('p');
  p.className = 'page-body';
  p.textContent = 'Supoort this project however you want.';

  main.appendChild(h1);
  main.appendChild(rule);
  main.appendChild(p);
}
