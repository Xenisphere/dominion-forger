// js/pages/about.js
function aboutPage(main) {
  const sections = [
    {
      heading: null,
      body: `Dominion Forger is a comprehensive Dominion companion website focused on kingdom generation, card discovery, filtering, analysis, and community-driven statistics. Its primary goal is to help players create more interesting and customized kingdoms than traditional randomizers, while also serving as a complete card database and long-term collection of gameplay insights.`
    },
    {
      heading: 'Advanced Kingdom Randomizer',
      body: `Generate kingdoms from your owned expansions with full control over the process. Includes synergy-aware generation, cost distribution controls, required and excluded cards, tags, types, and mechanics. Lock specific cards and randomize remaining slots. Supports landscapes, events, projects, ways, traits, allies, and prophecies.`
    },
    {
      heading: 'Complete Card Database',
      body: `Search and browse every card, landscape, and non-supply card across all expansions. Filter by expansion, cost, type, subtype, mechanic, dependency, and setup requirements. View full card information including text, costs, images, tags, and dependencies, with links to the Dominion Strategy Wiki.`
    },
    {
      heading: 'Deep Filtering System',
      body: `Multi-layer filtering across nearly every card attribute, with exact, any, all, and exclusion matching. Filter by automatically generated mechanics tags, expansion, edition, and collection ownership.`
    },
    {
      heading: 'Card Intelligence System',
      body: `Cards are automatically tagged based on their text and mechanics. Tags identify draw, villages, payload, attacks, trashing, gainers, and deck control, among many others. Derived tags identify engine pieces, payload pieces, gain engines, trash engines, terminal draw, and more.`
    },
    {
      heading: 'Statistics and Analytics',
      body: `Track card ratings, popularity, and games played. Discover commonly played card combinations, expansion rankings, and card synergies using community data. Explore trends and usage patterns across the Dominion ecosystem.`
    },
    {
      heading: 'Saved Kingdoms',
      body: `Save, import, and export kingdom setups. Maintain a personal kingdom library and share kingdoms with others.`
    },
    {
      heading: 'Collection Management',
      body: `Track owned expansions and restrict randomization to owned products. Collection preferences are saved locally in your browser.`
    },
    {
      heading: 'Community Features',
      body: `Optionally contribute anonymous gameplay statistics. Rate cards and kingdoms, submit feature requests, and provide feedback to help improve the site.`
    },
    {
      heading: 'Vision',
      body: `Dominion Forger aims to become the most powerful Dominion kingdom generation and analysis tool available. Rather than being only a randomizer, it functions as a kingdom generator, card encyclopedia, deck and kingdom management tool, strategy discovery platform, statistics engine, and community knowledge base. The site is designed to help players discover new interactions, avoid repetitive kingdoms, explore underused cards, build better engines, and gain deeper insight into Dominion as a whole.`
    },
    {
      heading: 'Disclaimer',
      body: `Dominion Forger is an independent fan project and is not affiliated with Donald X. Vaccarino, Rio Grande Games, or any official Dominion publisher. Card data is sourced from the Dominion Strategy Wiki.`
    },
  ];

  const h1 = document.createElement('h1');
  h1.className = 'page-heading';
  h1.textContent = 'About';
  main.appendChild(h1);

  const rule = document.createElement('hr');
  rule.className = 'page-rule';
  main.appendChild(rule);

  for (const { heading, body } of sections) {
    if (heading) {
      const h2 = document.createElement('h2');
      h2.className = 'about-heading';
      h2.textContent = heading;
      main.appendChild(h2);
    }

    const p = document.createElement('p');
    p.className = heading ? 'about-body' : 'about-intro';
    p.textContent = body;
    main.appendChild(p);
  }
}
