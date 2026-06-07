function homePage(main) {

    main.innerHTML = `
    <section class="hero">
      <h1 class="hero-title">Dominion Forger</h1>
      <p class="hero-subtitle">
        Advanced Dominion Kingdom Builder, Card Database, and Statistics Tool
      </p>

      <div class="hero-buttons">
        <a href="/dominion-forger/randomizer" class="hero-btn">Randomizer</a>
        <a href="/dominion-forger/browse" class="hero-btn">Browse Cards</a>
      </div>
    </section>

    <section class="stats-grid">

      <div class="stat-card">
        <h3>Total Games Played</h3>
        <div class="stat-value">42,183</div>
      </div>

      <div class="stat-card">
        <h3>Most Played Card</h3>
        <div class="stat-value">Village</div>
      </div>

      <div class="stat-card">
        <h3>Most Played Expansion</h3>
        <div class="stat-value">Prosperity</div>
      </div>

      <div class="stat-card">
        <h3>Cards Indexed</h3>
        <div class="stat-value">500+</div>
      </div>

    </section>

    <section class="featured-card">
      <h2>Featured Card</h2>

      <div class="feature-panel">

        <img
          src="images/Base/Village.jpg"
          class="featured-image"
          alt="Village"
        >

        <div>
          <h3>Village</h3>

          <p>
            +1 Card<br>
            +2 Actions
          </p>

          <a href="/dominion-forger/card/village">
            View Card
          </a>

        </div>

      </div>
    </section>
  `;
}