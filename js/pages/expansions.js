// js/pages/expansions.js
function expansionsPage(main) {
  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'Owned Expansions';

  const rule = document.createElement('hr');
  rule.className = 'page-rule';

  const p = document.createElement('p');
  p.className = 'page-body';
  p.textContent = 'Mark which expansions you possess.';

  main.appendChild(h1);
  main.appendChild(rule);
  main.appendChild(p);
}
