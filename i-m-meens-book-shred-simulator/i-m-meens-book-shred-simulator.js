// =============================================
// I.M. MEEN'S BOOK SHREDDING SIMULATOR 📚💀
// =============================================

// ---- BOOK IMAGES HERE ----
// Just drop filenames (relative paths) into this array!
const BOOK_IMAGES = [
  './assets/books/bible.png',
  './assets/books/random-novel.png',
  './assets/books/childrens-encyclopedia.png',
  './assets/books/childrens-animal-book.png',
];

// ---- I.M. MEEN VOICE LINES HERE ----
// Drop relative paths to audio files into this array!
const MEEN_VOICE_LINES = [
  './assets/sounds/I-M-Meen-GOOD.mp3',
  './assets/sounds/I-M-Meen-LAUGH.mp3',
];

let lastVoiceLineIndex = -1;

function playRandomVoiceLine() {
  if (MEEN_VOICE_LINES.length === 0) return;
  // Avoid repeating the same line twice in a row
  let index;
  do {
    index = Math.floor(Math.random() * MEEN_VOICE_LINES.length);
  } while (MEEN_VOICE_LINES.length > 1 && index === lastVoiceLineIndex);
  lastVoiceLineIndex = index;
  const audio = new Audio(MEEN_VOICE_LINES[index]);
  audio.volume = 1.0;
  audio.play().catch(e => console.warn('Voice line play failed:', e));
}

// =============================================
// GAME STATE
// =============================================
let money = 0;
let activeShredding = []; // array of active book shred jobs

const upgrades = {
  value: {
    label: 'Value',
    level: 0,
    maxLevel: 200,
    baseCost: 5,
    costIncrement: 75,
    color: '#ff6b35',
    description: '+€0.50 per book',
    getCost() { return this.baseCost + this.level * this.costIncrement; },
    getEffect() { return 2 + this.level * 0.5; }
  },
  speed: {
    label: 'Drop Speed',
    level: 0,
    maxLevel: 100,
    baseCost: 25,
    costIncrement: 225,
    color: '#4ecdc4',
    description: 'Books drop faster',
    getCost() { return this.baseCost + this.level * this.costIncrement; },
    getDuration() { return Math.max(1000, 6000 - this.level * 200); } // ms, min 1s
  },
  shredSpeed: {
    label: 'Shredder Speed',
    level: 0,
    maxLevel: 80,
    baseCost: 37,
    costIncrement: 337,
    color: '#e8c000',
    description: 'Shredder munches faster',
    getCost() { return this.baseCost + this.level * this.costIncrement; },
    getShredDuration(baseDuration) { return Math.max(400, baseDuration - this.level * 80); }
  },
  quantity: {
    label: 'Shred Quantity',
    level: 0,
    maxLevel: 60,
    baseCost: 50,
    costIncrement: 450,
    color: '#a855f7',
    description: '+1 simultaneous book',
    getCost() { return this.baseCost + this.level * this.costIncrement; },
    getMax() { return 1 + this.level; }
  }
};

// =============================================
// HELPERS
// =============================================
function formatMoney(val) {
  return '€' + val.toFixed(2).replace('.', ',');
}

function updateMoneyDisplay() {
  document.getElementById('money-counter').textContent = formatMoney(money);
}

function repositionMoneyCounter() {
  const panel = document.getElementById('upgrade-panel');
  const counter = document.getElementById('money-counter');
  const hubBtn = document.getElementById('hub-btn');
  const resetBtn = document.getElementById('reset-btn');
  if (!panel || !counter) return;
  const panelRect = panel.getBoundingClientRect();
  counter.style.top = (panelRect.bottom + 14) + 'px';
  if (hubBtn) {
    const counterRect = counter.getBoundingClientRect();
    hubBtn.style.top = (counterRect.bottom + 12) + 'px';
  }
  if (resetBtn && hubBtn) {
    const hubRect = hubBtn.getBoundingClientRect();
    resetBtn.style.top = (hubRect.bottom + 8) + 'px';
  }
}

function resetProgress() {
  const confirmed = window.confirm('⚠️ ARE YOU SURE?! This will wipe ALL your money and upgrades! Even Meen thinks this is a bad idea... 😱');
  if (!confirmed) return;
  money = 0;
  for (const upg of Object.values(upgrades)) {
    upg.level = 0;
  }
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch(e) {
    console.warn('Reset clear failed:', e);
  }
  updateMoneyDisplay();
  updateUpgradeButtons();
}

const SAVE_KEY = 'immeen_save';

function saveProgress() {
  const data = {
    money,
    upgradeLevels: Object.fromEntries(
      Object.entries(upgrades).map(([k, u]) => [k, u.level])
    )
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch(e) {
    console.warn('Save failed:', e);
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.money === 'number') money = data.money;
    if (data.upgradeLevels) {
      for (const [key, level] of Object.entries(data.upgradeLevels)) {
        if (upgrades[key] && typeof level === 'number') {
          upgrades[key].level = Math.min(level, upgrades[key].maxLevel);
        }
      }
    }
  } catch(e) {
    console.warn('Load failed:', e);
  }
}

function updateUpgradeButtons() {
  for (const [key, upg] of Object.entries(upgrades)) {
    const btn = document.getElementById('upgrade-' + key);
    if (!btn) continue;
    const atMax = upg.level >= upg.maxLevel;
    const cost = upg.getCost();
    const canAfford = money >= cost;

    if (atMax) {
      btn.innerHTML = `<span class="upg-label">${upg.label}</span><span class="upg-info">MAX LEVEL!</span>`;
      btn.disabled = true;
      btn.style.opacity = '0.6';
    } else {
      btn.innerHTML = `<span class="upg-label">${upg.label} <em>Lv.${upg.level}</em></span><span class="upg-info">${upg.description}<br><strong>${formatMoney(cost)}</strong></span>`;
      btn.disabled = !canAfford;
      btn.style.opacity = canAfford ? '1' : '0.5';
    }
  }
  requestAnimationFrame(repositionMoneyCounter);
}

// =============================================
// BOOK CREATION
// =============================================
let bookColorIndex = 0;
const BOOK_COLORS = [
  { cover: '#8B2FC9', spine: '#6A1F99', page: '#f5e6c8' },
  { cover: '#C0392B', spine: '#922B21', page: '#fef9e7' },
  { cover: '#1A5276', spine: '#154360', page: '#eaf2ff' },
  { cover: '#1E8449', spine: '#196F3D', page: '#eafaf1' },
  { cover: '#784212', spine: '#6E2C00', page: '#fdf3e3' },
];

function createBookElement() {
  const gameArea = document.getElementById('game-area');
  const shredder = document.getElementById('shredder-img');
  const shredderRect = shredder.getBoundingClientRect();
  const gameRect = gameArea.getBoundingClientRect();

  // Book element
  const book = document.createElement('div');
  book.classList.add('falling-book');

  // Shredder input slot center X — pixel-analysed: slot center is at ~68.7% of image width
  // The hopper opening (rows 0-150) spans cols 642-1116 on the 1280px source image
  const slotX = shredderRect.left - gameRect.left + shredderRect.width * 0.687;

  if (BOOK_IMAGES.length > 0) {
    // Use a real book image
    const imgSrc = BOOK_IMAGES[Math.floor(Math.random() * BOOK_IMAGES.length)];
    const img = document.createElement('img');
    img.src = imgSrc;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.display = 'block';
    book.appendChild(img);
    book.style.width = '80px';
    book.style.height = '110px';
  } else {
    // Draw a cute little SVG book as fallback
    const colors = BOOK_COLORS[bookColorIndex % BOOK_COLORS.length];
    bookColorIndex++;
    book.style.width = '70px';
    book.style.height = '95px';
    book.innerHTML = `
      <svg viewBox="0 0 70 95" xmlns="http://www.w3.org/2000/svg" width="70" height="95">
        <!-- Spine -->
        <rect x="0" y="2" width="12" height="91" rx="2" fill="${colors.spine}"/>
        <!-- Cover -->
        <rect x="10" y="0" width="60" height="95" rx="3" fill="${colors.cover}"/>
        <!-- Pages -->
        <rect x="13" y="4" width="54" height="87" rx="1" fill="${colors.page}"/>
        <!-- Lines on pages -->
        <line x1="18" y1="18" x2="62" y2="18" stroke="#ccc" stroke-width="1.5"/>
        <line x1="18" y1="26" x2="62" y2="26" stroke="#ccc" stroke-width="1.5"/>
        <line x1="18" y1="34" x2="62" y2="34" stroke="#ccc" stroke-width="1.5"/>
        <line x1="18" y1="42" x2="62" y2="42" stroke="#ccc" stroke-width="1.5"/>
        <line x1="18" y1="50" x2="62" y2="50" stroke="#ccc" stroke-width="1.5"/>
        <!-- Title block -->
        <rect x="18" y="58" width="44" height="28" rx="2" fill="${colors.spine}" opacity="0.4"/>
      </svg>`;
  }

  // Start above screen
  book.style.position = 'absolute';
  book.style.left = (slotX - 35) + 'px';
  book.style.top = '-120px';
  book.style.zIndex = '5';
  book.style.transformOrigin = 'center bottom';

  gameArea.appendChild(book);
  return { el: book, slotX };
}

// =============================================
// SHREDDING ANIMATION
// =============================================
function shredBook() {
  const maxActive = upgrades.quantity.getMax();
  if (activeShredding.length >= maxActive) return;

  const shredBtn = document.getElementById('shred-btn');
  const gameArea = document.getElementById('game-area');
  const shredder = document.getElementById('shredder-img');

  const gameRect = gameArea.getBoundingClientRect();
  const shredderRect = shredder.getBoundingClientRect();

  // Target Y: top of the shredder input slot (approx 18% from top of shredder)
  const slotTopY = shredderRect.top - gameRect.top + shredderRect.height * 0.18;
  // Book disappears when its bottom hits this Y
  const disappearY = slotTopY + 10;

  const { el: book } = createBookElement();

  const duration = upgrades.speed.getDuration(); // ms for full descent
  const startTime = performance.now();
  const startY = -120;
  const endY = disappearY - (book.clientHeight || 95);

  const job = { el: book, done: false };
  activeShredding.push(job);

  // Update button state
  updateShredButton();

  // Wobble as it drops (looks more fun)
  let wobbleDir = 1;

  function animate(now) {
    if (job.done) return;
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease in (accelerate slightly)
    const eased = progress < 0.5
      ? 2 * progress * progress
      : -1 + (4 - 2 * progress) * progress;

    const currentY = startY + (endY - startY) * eased;

    // Slight wobble rotation
    const wobble = Math.sin(elapsed / 120) * 3;
    book.style.transform = `rotate(${wobble}deg)`;
    book.style.top = currentY + 'px';

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Book is at the slot — now slide it "into" the shredder (downward, clipped)
      slideIntoShredder(book, job, slotTopY, duration);
    }
  }

  requestAnimationFrame(animate);
}

function slideIntoShredder(book, job, slotTopY, duration) {
  const gameArea = document.getElementById('game-area');
  const shredder = document.getElementById('shredder-img');
  const shredderRect = shredder.getBoundingClientRect();
  const gameRect = gameArea.getBoundingClientRect();

  const shredderTopInGame = shredderRect.top - gameRect.top;
  const bookHeight = book.clientHeight || 95;

  // Clip the book so it appears to go INTO the shredder
  const baseShredDuration = Math.max(800, duration * 0.4);
  const shredDuration = upgrades.shredSpeed.getShredDuration(baseShredDuration);
  const startTime = performance.now();
  // Capture the book's starting top once — don't keep nudging it each frame
  const bookStartTop = parseFloat(book.style.top) || 0;

  // Play the shred sound, sped up to match shredDuration
  playShredSound(shredDuration);

  function animateShred(now) {
    if (job.done) return; // guard: stop if another job cancelled this
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / shredDuration, 1);

    // Clip from top down as book gets eaten into the slot
    const visibleHeight = Math.round(bookHeight * (1 - progress));
    book.style.clipPath = `inset(${bookHeight - visibleHeight}px 0 0 0)`;
    // Creep the book downward by a fixed fraction of its height
    book.style.top = (bookStartTop + progress * bookHeight * 0.3) + 'px';

    // Shredder shake effect!
    if (progress > 0.1 && progress < 0.9) {
      const shake = Math.sin(elapsed / 40) * 2;
      shredder.style.transform = `translateX(${shake}px)`;
    } else {
      shredder.style.transform = '';
    }

    if (progress < 1) {
      requestAnimationFrame(animateShred);
    } else {
      // Book is fully shredded!
      book.remove();
      shredder.style.transform = '';
      job.done = true;

      // Earn money!
      money += upgrades.value.getEffect();
      updateMoneyDisplay();

      // Remove from active list
      activeShredding = activeShredding.filter(j => j !== job);
      updateShredButton();
      updateUpgradeButtons();

      // MEEN LAUGH REACTION 😈
      triggerMeenReaction();
      playRandomVoiceLine();
      saveProgress();
    }
  }

  requestAnimationFrame(animateShred);
}

// =============================================
// MEEN REACTION ANIMATION
// =============================================
function triggerMeenReaction() {
  const meen = document.getElementById('meen-img');
  meen.classList.remove('meen-excited');
  void meen.offsetWidth; // reflow trick
  meen.classList.add('meen-excited');
  setTimeout(() => meen.classList.remove('meen-excited'), 600);
}

// =============================================
// SHRED BUTTON STATE
// =============================================
function updateShredButton() {
  const btn = document.getElementById('shred-btn');
  const maxActive = upgrades.quantity.getMax();
  if (activeShredding.length >= maxActive) {
    btn.style.transform = 'scale(0.96)';
    btn.style.filter = 'brightness(0.7)';
  } else {
    btn.style.transform = '';
    btn.style.filter = '';
  }
}

// =============================================
// UPGRADE HANDLERS
// =============================================
function buyUpgrade(key) {
  const upg = upgrades[key];
  if (upg.level >= upg.maxLevel) return;
  const cost = upg.getCost();
  if (money < cost) return;
  money -= cost;
  upg.level++;
  updateMoneyDisplay();
  updateUpgradeButtons();
  saveProgress();
}

// =============================================
// SHRED SOUND
// =============================================
// We use Web Audio API so we can control playbackRate (pitch/speed) and
// do a proper gain fade-out timed to the animation.
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Cache the decoded shred sound buffer so we don't re-fetch every shred
let shredSoundBuffer = null;
let shredSoundLoading = false;

async function loadShredSound() {
  if (shredSoundBuffer || shredSoundLoading) return;
  shredSoundLoading = true;
  try {
    const ctx = getAudioContext();
    const res = await fetch('./assets/sounds/shred.mp3');
    const arrayBuffer = await res.arrayBuffer();
    shredSoundBuffer = await ctx.decodeAudioData(arrayBuffer);
  } catch(e) {
    console.warn('Shred sound load failed:', e);
  }
  shredSoundLoading = false;
}

function playShredSound(shredDuration) {
  if (!shredSoundBuffer) return null;
  const ctx = getAudioContext();

  // playbackRate: base shred is ~800ms at level 0, speed up proportionally
  // Base shred duration at level 0 is 800ms (our floor), so we scale relative to that
  const BASE_SHRED_MS = 800;
  const rate = Math.min(BASE_SHRED_MS / shredDuration, 4); // cap at 4x speed

  const source = ctx.createBufferSource();
  source.buffer = shredSoundBuffer;
  source.playbackRate.value = rate;
  source.loop = true; // loop in case the shred takes longer than the sound clip

  // Gain node for fade-out
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1.0;

  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start();

  // Schedule fade-out to start 0.5s before shred ends
  const fadeStartDelay = Math.max(0, (shredDuration - 500) / 1000); // convert to seconds
  const fadeEndDelay = shredDuration / 1000;

  gainNode.gain.setValueAtTime(1.0, ctx.currentTime + fadeStartDelay);
  gainNode.gain.linearRampToValueAtTime(0.0, ctx.currentTime + fadeEndDelay);

  // Auto-stop after shredDuration (with tiny buffer)
  source.stop(ctx.currentTime + fadeEndDelay + 0.05);

  return { source, gainNode };
}
let musicStarted = false;

function startMusic() {
  if (musicStarted) return;
  musicStarted = true;
  const audio = document.getElementById('theme-music');
  if (!audio) return;
  audio.volume = 0.6;
  audio.loop = true;
  audio.play().catch(e => console.warn('Music play failed:', e));
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  loadProgress();
  updateMoneyDisplay();
  updateUpgradeButtons();
  // Wait one frame so the upgrade panel has rendered its full height
  requestAnimationFrame(repositionMoneyCounter);

  document.getElementById('shred-btn').addEventListener('click', shredBook);
  document.getElementById('reset-btn').addEventListener('click', resetProgress);

  // Wire upgrade buttons
  for (const key of Object.keys(upgrades)) {
    const btn = document.getElementById('upgrade-' + key);
    if (btn) btn.addEventListener('click', () => buyUpgrade(key));
  }

  // Start music on first click anywhere — browsers require user gesture
  document.addEventListener('click', startMusic, { once: true });

  // Preload shred sound and ensure AudioContext is resumed on first interaction
  document.addEventListener('click', () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    loadShredSound();
  }, { once: true });
});