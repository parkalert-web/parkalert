/** Point d'entrée : chargement, écran d'accueil, réglages. */
import { Game } from './game.js';

const TIPS = [
  "Maintenez Tab pour ouvrir la roue des armes, la scène passe au ralenti.",
  "Maintenez G pour changer de personnage : Michael, Franklin ou Trevor.",
  "X déclenche la capacité spéciale du personnage.",
  "Entrez dans le garage Los Santos Customs avec une voiture : réparation, nouvelle peinture… et plus de police.",
  "Les étoiles clignotent quand la police vous a perdu de vue : tenez bon.",
  "Appuyez sur M pour ouvrir la carte, puis cliquez pour poser une destination.",
  "Les lettres jaunes au sol lancent une mission. Chaque personnage a la sienne.",
  "Frein à main + volant : la dérive fonctionne comme il faut.",
  "Tapez ARSENAL, FORTUNE ou BOLIDE pendant le jeu.",
  "Les stations de radio se changent avec , et . une fois en voiture.",
];

const root = document.getElementById('app');
const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const fill = document.getElementById('load-fill');
const stepEl = document.getElementById('load-step');
const tipEl = document.getElementById('load-tip');
const playBtn = document.getElementById('btn-play');

let tipIndex = Math.floor(Math.random() * TIPS.length);
tipEl.textContent = TIPS[tipIndex];
const tipTimer = setInterval(() => {
  tipIndex = (tipIndex + 1) % TIPS.length;
  tipEl.style.opacity = '0';
  setTimeout(() => { tipEl.textContent = TIPS[tipIndex]; tipEl.style.opacity = '.5'; }, 250);
}, 5200);

const game = new Game(canvas, root, (label, pct) => {
  stepEl.textContent = label;
  fill.style.width = `${pct}%`;
});
// Exposé volontairement : console de débogage et tests de bout en bout.
window.game = game;

function fatal(err) {
  console.error(err);
  const msg = String(err && err.message ? err.message : err);
  stepEl.textContent = 'Erreur au démarrage';
  tipEl.textContent = msg.includes('WebGL')
    ? "Ce navigateur ne prend pas en charge WebGL 2. Essayez une version récente de "
      + 'Chrome, Edge, Firefox ou Safari, et vérifiez que l’accélération matérielle est active.'
    : msg;
  tipEl.style.color = '#e07a7a';
}

/** Réglages imposés par l'URL : ?scale=50&shadows=0&quality=fixed */
function applyUrlSettings() {
  const params = new URLSearchParams(location.search);
  if (params.has('scale')) {
    const v = Number(params.get('scale'));
    game.renderer.renderScale = v / 100;
    document.getElementById('opt-scale').value = String(v);
  }
  if (params.get('shadows') === '0') {
    game.renderer.shadowsOn = false;
    game.userShadows = false;
    document.getElementById('opt-shadows').checked = false;
  }
  if (params.get('quality') === 'fixed') game.adaptiveQuality = false;
}

(async () => {
  try {
    await game.load();
    applyUrlSettings();
    stepEl.textContent = 'Prêt';
    playBtn.hidden = false;
    playBtn.focus();
  } catch (e) { fatal(e); }
})();

function launch() {
  clearInterval(tipTimer);
  const resumed = game.loadSave();
  loading.classList.add('done');
  game.audio.init();
  game.audio.resume();
  game.audio.setStation(1);
  game.start();
  if (resumed) {
    game.notify('Partie reprise', `${game.missions.done.size} mission(s) déjà réussie(s)`);
  }
  game.input.requestLock();
}
playBtn.addEventListener('click', launch);
addEventListener('keydown', (e) => {
  if (!playBtn.hidden && !loading.classList.contains('done') && (e.code === 'Enter' || e.code === 'Space')) launch();
});

/* ------------------------------------------------------------- réglages */

document.getElementById('btn-resume').addEventListener('click', () => game.togglePause());
document.getElementById('btn-newgame').addEventListener('click', () => {
  if (confirm('Effacer la progression et recommencer une partie ?')) game.newGame();
});
document.getElementById('opt-shadows').addEventListener('change', (e) => {
  game.renderer.shadowsOn = e.target.checked;
  game.userShadows = e.target.checked;
});
document.getElementById('opt-scale').addEventListener('input', (e) => {
  game.renderer.renderScale = e.target.value / 100;
});
document.getElementById('opt-sens').addEventListener('input', (e) => {
  game.input.sensitivity = e.target.value / 10000;
});
document.getElementById('opt-vol').addEventListener('input', (e) => {
  game.audio.setVolume(e.target.value / 100);
});
document.getElementById('opt-music').addEventListener('input', (e) => {
  game.audio.setMusicVolume(e.target.value / 100);
});

addEventListener('resize', () => { if (game.renderer) game.renderer.resize(); });
