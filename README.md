<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dominion Forger</title>

<style>
:root {
  --bg: #1e1f24;
  --panel: #2a2c33;
  --border: #3a3d46;
  --text: #e6e6e6;

  --coin: #d4af37;
  --action: #4aa3ff;
  --buy: #7ed957;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', sans-serif;
}

body {
  background: var(--bg);
  color: var(--text);
}

/* HEADER */
.header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 10;
}

.menu-btn {
  width: 28px;
  height: 28px;
  cursor: pointer;
  margin-right: 12px;
  transition: transform 0.2s;
}

.menu-btn:hover {
  transform: scale(1.1);
}

.title {
  font-size: 20px;
  font-weight: bold;
}

/* SIDEBAR */
.sidebar {
  position: fixed;
  top: 0;
  left: -260px;
  width: 260px;
  height: 100%;
  background: var(--panel);
  border-right: 1px solid var(--border);
  padding: 20px;
  transition: left 0.3s ease;
  z-index: 20;
}

.sidebar.open {
  left: 0;
}

.sidebar h2 {
  margin-bottom: 20px;
}

.sidebar a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin-bottom: 8px;
  color: var(--text);
  text-decoration: none;
  border-radius: 6px;
  transition: background 0.2s;
}

.sidebar a img {
  width: 18px;
  height: 18px;
  opacity: 0.8;
}

.sidebar a:hover {
  background: var(--border);
}

/* OVERLAY */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  z-index: 15;
}

.overlay.active {
  opacity: 1;
  pointer-events: all;
}

/* MAIN */
.main {
  padding: 40px 20px;
  text-align: center;
}

.hero {
  margin-bottom: 40px;
}

.hero h1 {
  font-size: 36px;
  margin-bottom: 10px;
}

.hero p {
  color: #aaa;
}

/* BUTTON GRID */
.actions {
  display: grid;
  gap: 16px;
  max-width: 420px;
  margin: auto;
}

.button {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel);
  cursor: pointer;
  transition: transform 0.15s, background 0.2s;
  font-size: 16px;
  text-align: left;
}

.button img {
  width: 28px;
  height: 28px;
  opacity: 0.9;
}

.button:hover {
  transform: translateY(-3px);
}

.button.random { border-left: 4px solid var(--coin); }
.button.browse { border-left: 4px solid var(--action); }
.button.saved  { border-left: 4px solid var(--buy); }

/* FOOTER */
.footer {
  margin-top: 60px;
  font-size: 12px;
  color: #777;
}
</style>
</head>

<body>

<!-- SIDEBAR -->
<div class="sidebar" id="sidebar">
  <h2>Menu</h2>

  <a href="#"><img src="assets/icons/home.svg"> Home</a>
  <a href="#"><img src="assets/icons/random.svg"> Randomizer</a>
  <a href="#"><img src="assets/icons/cards.svg"> Card Browser</a>
  <a href="#"><img src="assets/icons/filter.svg"> Filters</a>
  <a href="#"><img src="assets/icons/save.svg"> Saved Decks</a>
  <a href="#"><img src="assets/icons/stats.svg"> Stats</a>
  <a href="#"><img src="assets/icons/settings.svg"> Settings</a>
</div>

<div class="overlay" id="overlay"></div>

<!-- HEADER -->
<div class="header">
  <img src="assets/icons/menu.svg" class="menu-btn" onclick="toggleMenu()">
  <div class="title">Dominion Forger</div>
</div>

<!-- MAIN -->
<div class="main">

  <div class="hero">
    <h1>Forge Better Kingdoms</h1>
    <p>Smarter randomization. Deeper strategy.</p>
  </div>

  <div class="actions">

    <div class="button random" onclick="press(this)">
      <img src="assets/icons/random.svg">
      <div>
        <div>Generate Kingdom</div>
        <small>Build a balanced set with synergy</small>
      </div>
    </div>

    <div class="button browse" onclick="press(this)">
      <img src="assets/icons/cards.svg">
      <div>
        <div>Browse Cards</div>
        <small>Explore all Dominion cards</small>
      </div>
    </div>

    <div class="button saved" onclick="press(this)">
      <img src="assets/icons/save.svg">
      <div>
        <div>Saved Decks</div>
        <small>View and manage saved kingdoms</small>
      </div>
    </div>

  </div>

  <div class="footer">
    Dominion Forger © 2026
  </div>

</div>

<script>
function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('active');
}

document.getElementById('overlay').onclick = toggleMenu;

function press(el) {
  el.style.transform = "scale(0.97)";
  setTimeout(() => el.style.transform = "", 100);
}
</script>

</body>
</html>
