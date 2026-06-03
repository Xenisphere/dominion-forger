// js/pages/help.js
function helpPage(main) {
  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'Help & Feedback';

  const rule = document.createElement('hr');
  rule.className = 'page-rule';

  const p = document.createElement('p');
  p.className = 'page-body';
  p.textContent = 'Search for keywords, and to submit feedback.';

  main.appendChild(h1);
  main.appendChild(rule);
  main.appendChild(p);
}
