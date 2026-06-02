// js/pages/home.js
function homePage(main) {
  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'Home';

  const rule = document.createElement('hr');
  rule.className = 'page-rule';

  const p = document.createElement('p');
  p.className = 'page-body';
  p.textContent = 'The kingdom awaits.';

  main.appendChild(h1);
  main.appendChild(rule);
  main.appendChild(p);
}
