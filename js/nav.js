// nav.js — marks the active nav link based on current page filename
(function () {
  const links = document.querySelectorAll('nav a');
  const current = location.pathname.split('/').pop() || 'index.html';
  links.forEach(a => {
    const href = a.getAttribute('href').split('/').pop();
    if (href === current) a.classList.add('active');
  });
})();

