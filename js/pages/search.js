// js/pages/search.js
function searchPage(main) {
	const h1 = document.createElement('h1');
	h1.className = 'page-heading';
	h1.textContent = 'Search';

	const rule = document.createElement('hr');
	rule.className = 'page-rule';

	const p = document.createElement('p');
	p.className = 'page-body';
	p.textContent = 'Search for cards & keywords';

	main.appendChild(h1);
	main.appendChild(rule);
	main.appendChild(p);
}
