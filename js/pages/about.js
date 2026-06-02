// js/pages/about.js
function aboutPage(main) {
  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'About';

  const rule = document.createElement('hr');
  rule.className = 'page-rule';

  const p = document.createElement('p');
  p.className = 'page-body';
  p.textContent = 'On the origins of this compendium.';

  main.appendChild(h1);
  main.appendChild(rule);
  main.appendChild(p);
}
