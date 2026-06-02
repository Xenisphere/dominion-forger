// js/pages/statistics.js
function statisticsPage(main) {
  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'Statistics';

  const rule = document.createElement('hr');
  rule.className = 'page-rule';

  const p = document.createElement('p');
  p.className = 'page-body';
  p.textContent = 'Charts and tallies of your dominion.';

  main.appendChild(h1);
  main.appendChild(rule);
  main.appendChild(p);
}
