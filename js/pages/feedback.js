// js/pages/feedback.js
function feedbackPage(main) {
    const h1 = document.createElement('h1');
    h1.className = 'page-heading';
    h1.textContent = 'Feedback';

    const rule = document.createElement('hr');
    rule.className = 'page-rule';

    const p = document.createElement('p');
    p.className = 'page-body';
    p.textContent = 'Submit any bugs, issues, or tips on how to improve this tool.';

    main.appendChild(h1);
    main.appendChild(rule);
    main.appendChild(p);
}
