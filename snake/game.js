/* Neoon Snake — a self-contained arcade game.
   Plain ES5-compatible JS, no dependencies. Works served or straight off disk. */
(function () {
  'use strict';

  /* ────────────────────────────── Config ── */
  var GRID = 20;              // cells per row / column
  var CELL = 26;              // logical pixels per cell
  var LOGICAL = GRID * CELL;  // internal canvas square
  var COMBO_WINDOW = 3200;    // ms between bites to keep a combo alive
  var GOLDEN_CHANCE = 0.13;   // chance a new orb is golden
  var GOLDEN_LIFETIME = 5200; // ms a golden orb lasts before becoming normal
  var GOLDEN_POINTS = 50;
  var BASE_POINTS = 10;

  var DIFF = {
    easy:   { base: 175, min: 115, speedup: 5 },
    normal: { base: 150, min: 80,  speedup: 3 },
    hard:   { base: 118, min: 58,  speedup: 2 }
  };

  /* ────────────────────────────── State ── */
  var state = 'menu'; // menu | playing | paused | over
  var snake = [];
  var dir = { x: 1, y: 0 };
  var dirQueue = [];
  var food = null;
  var golden = false;
  var goldenExpires = 0;

  var score = 0;
  var foodEaten = 0;
  var combo = 0;
  var lastEatAt = 0;

  var stepMs = 150;
  var minStep = 80;
  var speedupEvery = 3;

  var acc = 0;
  var lastT = 0;
  var raf = 0;
  var overAt = 0;

  var difficulty = loadPref('diff', 'normal');
  var wrapMode = loadPref('wrap', 'false') === 'true';
  var soundOn = loadPref('sound', 'true') !== 'false';

  var hiScore = Number(loadPref('hiScore', '0')) || 0;
  var hiCombo = Number(loadPref('hiCombo', '0')) || 0;

  var particles = [];
  var floaters = [];
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ────────────────────────────── DOM ── */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var lengthEl = document.getElementById('length');
  var levelEl = document.getElementById('level');
  var overlay = document.getElementById('overlay');
  var menuPanel = document.getElementById('menu-panel');
  var pausePanel = document.getElementById('pause-panel');
  var overPanel = document.getElementById('over-panel');
  var comboBanner = document.getElementById('combo-banner');

  var startBtn = document.getElementById('start-btn');
  var resumeBtn = document.getElementById('resume-btn');
  var restartBtn = document.getElementById('restart-btn');
  var replayBtn = document.getElementById('replay-btn');
  var wrapToggle = document.getElementById('wrap-toggle');
  var muteBtn = document.getElementById('mute-btn');

  var segBtns = Array.prototype.slice.call(document.querySelectorAll('.seg-btn'));

  /* ────────────────────────────── Setup ── */
  canvas.width = LOGICAL;
  canvas.height = LOGICAL;
  fitCanvas();

  function fitCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(LOGICAL * dpr);
    canvas.height = Math.round(LOGICAL * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.style.width = '';
    canvas.style.height = '';
  }

  comboBanner.textContent = '';
  seedIdleBoard();
  setHiText();
  reflectSettingsUI();
  updateHUD();
  showPanel(menuPanel);
  lastT = performance.now();
  raf = requestAnimationFrame(loop);

  /* ────────────────────────────── Audio ── */
  var audioCtx = null;
  function audio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur, type, vol, whenDelay) {
    if (!soundOn) return;
    var ctxa = audio();
    if (!ctxa) return;
    var t0 = ctxa.currentTime + (whenDelay || 0);
    var osc = ctxa.createOscillator();
    var gain = ctxa.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol || 0.16, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctxa.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function sndCombo(combo) {
    var base = 440 + Math.min(combo - 1, 8) * 60;
    tone(base, 0.09, 'square', 0.14);
    tone(base * 1.5, 0.09, 'square', 0.1, 0.06);
  }
  function sndGolden() {
    tone(659, 0.12, 'sine', 0.16);
    tone(880, 0.12, 'sine', 0.16, 0.09);
    tone(1318, 0.16, 'sine', 0.14, 0.18);
  }
  function sndDie() {
    tone(330, 0.18, 'sawtooth', 0.18);
    tone(220, 0.18, 'sawtooth', 0.16, 0.14);
    tone(110, 0.4, 'sawtooth', 0.14, 0.28);
  }
  function sndStart() {
    tone(392, 0.09, 'sine', 0.14);
    tone(523, 0.09, 'sine', 0.14, 0.08);
    tone(659, 0.14, 'sine', 0.14, 0.16);
  }

  /* ────────────────────────────── Helpers ── */
  function loadPref(k, d) {
    try { var v = localStorage.getItem('neonSnake.' + k); return v == null ? d : v; } catch (e) { return d; }
  }
  function savePref(k, v) {
    try { localStorage.setItem('neonSnake.' + k, String(v)); } catch (e) { /* private mode */ }
  }

  function between(x, a, b) { return x >= a && x <= b; }

  function emptyCells() {
    var occupied = {};
    for (var i = 0; i < snake.length; i++) occupied[snake[i].x + ',' + snake[i].y] = true;
    var out = [];
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        if (!occupied[x + ',' + y]) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  function spawnFood(forceGolden) {
    var cells = emptyCells();
    if (cells.length === 0) { die(); return; }
    food = cells[Math.floor(Math.random() * cells.length)];
    golden = forceGolden || Math.random() < GOLDEN_CHANCE;
    goldenExpires = performance.now() + GOLDEN_LIFETIME;
  }

  function seedIdleBoard() {
    var cx = Math.floor(GRID / 2);
    var cy = Math.floor(GRID / 2);
    snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
    dir = { x: 1, y: 0 };
    dirQueue = [];
    spawnFood(false);
  }

  function resetBoard() {
    var cfg = DIFF[difficulty] || DIFF.normal;
    stepMs = cfg.base;
    minStep = cfg.min;
    speedupEvery = cfg.speedup;
    seedIdleBoard();
    score = 0;
    foodEaten = 0;
    combo = 0;
    lastEatAt = 0;
    acc = 0;
    particles = [];
    floaters = [];
    hideCombo();
  }

  /* ────────────────────────────── Game flow ── */
  function startGame() {
    resetBoard();
    state = 'playing';
    showPanel(null);
    canvas.focus();
    sndStart();
    lastT = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    updateHUD();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    showPanel(pausePanel);
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    showPanel(null);
    canvas.focus();
    lastT = performance.now();
  }
  function die() {
    state = 'over';
    overAt = performance.now();
    saveHi();
    showPanel(overPanel);
    sndDie();
    spawnExplosion(snake[0]);
    updateOverPanel();
    updateHUD();
  }

  function restart() { startGame(); }

  /* ────────────────────────────── Scoring ── */
  function saveHi() {
    if (score > hiScore) {
      hiScore = score;
      savePref('hiScore', hiScore);
    }
    if (combo > hiCombo) {
      hiCombo = combo;
      savePref('hiCombo', hiCombo);
    }
    setHiText();
  }

  function setHiText() { bestEl.textContent = hiScore; }

  function eat() {
    var now = performance.now();
    if (combo >= 1 && now - lastEatAt <= COMBO_WINDOW) combo++;
    else combo = 1;
    lastEatAt = now;

    var points = (golden ? GOLDEN_POINTS : BASE_POINTS) * combo;
    score += points;

    foodEaten++;
    if (combo > hiCombo) { hiCombo = combo; savePref('hiCombo', hiCombo); }
    if (foodEaten % speedupEvery === 0) {
      stepMs = Math.max(minStep, stepMs - 8);
    }

    spawnParticles(food.x, food.y, golden ? '#ffd166' : '#f43f5e');
    floaters.push({ x: food.x, y: food.y, text: '+' + points, born: now, golden: golden });
    showCombo();

    if (golden) sndGolden(); else sndCombo(combo);
    saveHi();
    spawnFood(false);
    updateHUD();
  }

  /* ────────────────────────────── Movement ── */
  function step() {
    if (dirQueue.length) {
      var nd = dirQueue.shift();
      // forbid a 180° reversal against the move we actually applied last.
      if (!(nd.x === -dir.x && nd.y === -dir.y)) dir = nd;
    }

    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // wrap mode: pass through edges
    if (wrapMode) {
      head.x = (head.x + GRID) % GRID;
      head.y = (head.y + GRID) % GRID;
    } else if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
      die();
      return;
    }

    var eating = food && head.x === food.x && head.y === food.y;
    // if not eating the tail moves away this tick, so it is safe to enter
    var body = eating ? snake : snake.slice(0, -1);
    for (var i = 0; i < body.length; i++) {
      if (body[i].x === head.x && body[i].y === head.y) { die(); return; }
    }

    snake.unshift(head);
    if (eating) eat();
    else snake.pop();
  }

  function queueDir(nd) {
    var last = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if ((nd.x === -last.x && nd.y === -last.y) || (nd.x === last.x && nd.y === last.y)) return;
    if (dirQueue.length < 3) dirQueue.push(nd);
  }

  /* ────────────────────────────── Particles / floaters ── */
  function spawnParticles(gx, gy, color) {
    var cx = (gx + 0.5) * CELL;
    var cy = (gy + 0.5) * CELL;
    var n = reducedMotion ? 8 : 18;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 120;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 600 + Math.random() * 300,
        born: performance.now(),
        size: 1.6 + Math.random() * 2.4,
        color: color
      });
    }
  }

  function spawnExplosion(head) {
    var cx = (head.x + 0.5) * CELL;
    var cy = (head.y + 0.5) * CELL;
    var n = reducedMotion ? 14 : 34;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 60 + Math.random() * 180;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 700 + Math.random() * 500,
        born: performance.now(),
        size: 2 + Math.random() * 3,
        color: i % 2 ? '#22d3ee' : '#f43f5e'
      });
    }
  }

  function updateParticles(now, dt) {
    particles = particles.filter(function (p) { return now - p.born < p.life; });
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    floaters = floaters.filter(function (f) { return now - f.born < 900; });
  }

  /* ────────────────────────────── HUD / UI ── */
  function updateHUD() {
    scoreEl.textContent = score;
    lengthEl.textContent = snake.length;
    levelEl.textContent = 1 + Math.floor(foodEaten / speedupEvery);
    setHiText();
  }

  var comboHideTimer = 0;
  function showCombo() {
    if (combo <= 1) { hideCombo(); return; }
    comboBanner.textContent = 'Combo ×' + combo;
    comboBanner.hidden = false;
    // force reflow so the transition re-triggers
    void comboBanner.offsetWidth;
    comboBanner.classList.add('show');
    clearTimeout(comboHideTimer);
    comboHideTimer = setTimeout(hideCombo, 900);
  }
  function hideCombo() {
    comboBanner.classList.remove('show');
    clearTimeout(comboHideTimer);
    setTimeout(function () { if (!comboBanner.classList.contains('show')) comboBanner.hidden = true; }, 220);
  }

  function updateOverPanel() {
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-best').textContent = hiScore;
    document.getElementById('final-combo').textContent = '×' + combo;
    document.getElementById('final-length').textContent = snake.length;
    var newBest = document.getElementById('newbest-copy');
    newBest.hidden = !(score === hiScore && score > 0);
    document.getElementById('over-kicker').textContent = (score === hiScore && score > 0) ? 'New best!' : 'Game over';
  }

  function showPanel(panel) {
    menuPanel.hidden = panel !== menuPanel;
    pausePanel.hidden = panel !== pausePanel;
    overPanel.hidden = panel !== overPanel;
    overlay.hidden = panel == null;
  }

  /* ────────────────────────────── Rendering ── */
  function render(now) {
    ctx.clearRect(0, 0, LOGICAL, LOGICAL);

    // board background
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(0, 0, LOGICAL, LOGICAL);

    // grid
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var g = 1; g < GRID; g++) {
      var p = g * CELL;
      ctx.moveTo(p, 0); ctx.lineTo(p, LOGICAL);
      ctx.moveTo(0, p); ctx.lineTo(LOGICAL, p);
    }
    ctx.stroke();

    // food glow under snake
    if (food) drawFood(food, now);

    // snake
    drawSnake(now);

    // particles
    for (var i = 0; i < particles.length; i++) {
      var pt = particles[i];
      var t = 1 - (now - pt.born) / pt.life;
      if (t <= 0) continue;
      ctx.globalAlpha = t;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (0.6 + t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // floating score text
    for (var j = 0; j < floaters.length; j++) {
      var f = floaters[j];
      var ft = (now - f.born) / 900;
      var alpha = 1 - ft;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.golden ? '#ffd166' : '#ffffff';
      ctx.font = '700 ' + (f.golden ? 17 : 14) + 'px ' + '"Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.text, (f.x + 0.5) * CELL, (f.y + 0.5) * CELL - ft * CELL);
    }
    ctx.globalAlpha = 1;
  }

  function drawFood(f, now) {
    var cx = (f.x + 0.5) * CELL;
    var cy = (f.y + 0.5) * CELL;
    var pulse = reducedMotion ? 1 : 0.86 + 0.14 * Math.sin(now / 220);
    var color = golden ? '#ffd166' : '#f43f5e';
    var glow = golden ? 'rgba(255,209,102,0.7)' : 'rgba(244,63,94,0.6)';

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = golden ? 22 : 14;

    var r = CELL * 0.32 * pulse;
    if (golden) {
      // star gem
      drawStar(cx, cy, r * 1.15, r * 0.5, 5, color);
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (golden) {
      // timer ring around golden orb
      var remain = Math.max(0, 1 - (now - goldenExpires) / GOLDEN_LIFETIME);
      ctx.strokeStyle = 'rgba(255,209,102,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remain);
      ctx.stroke();
    }
  }

  function drawStar(cx, cy, outer, inner, points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = (i * Math.PI) / points - Math.PI / 2;
      var x = cx + Math.cos(a) * r;
      var y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawSnake(now) {
    var n = snake.length;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (var i = n - 1; i >= 0; i--) {
      var s = snake[i];
      var cx = (s.x + 0.5) * CELL;
      var cy = (s.y + 0.5) * CELL;
      // head is bright cyan, tail fades to violet
      var t = n === 1 ? 0 : i / (n - 1);
      var hue = 187 + t * 90; // cyan -> violet
      var light = 60 - t * 8;
      var alpha = 1 - t * 0.25;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'hsl(' + hue + ', 90%, ' + light + '%)';
      ctx.shadowColor = i === 0 ? 'rgba(34,211,238,0.8)' : 'rgba(34,211,238,0.0)';
      ctx.shadowBlur = i === 0 && !reducedMotion ? 16 : 0;
      var inset = 2;
      roundRect(ctx, cx - CELL / 2 + inset, cy - CELL / 2 + inset, CELL - inset * 2, CELL - inset * 2, 7);
      ctx.fill();
    }
    ctx.restore();

    // eyes on head
    var h = snake[0];
    drawEyes(h.x, h.y, dir);
  }

  function drawEyes(x, y, d) {
    var cx = (x + 0.5) * CELL;
    var cy = (y + 0.5) * CELL;
    var off = CELL * 0.14;
    var px = d.x, py = d.y;
    // perpendicular unit
    var pxn = -py, pyn = px;
    var e1x = cx + px * off + pxn * off * 0.7;
    var e1y = cy + py * off + pyn * off * 0.7;
    var e2x = cx + px * off - pxn * off * 0.7;
    var e2y = cy + py * off - pyn * off * 0.7;
    ctx.fillStyle = '#04121a';
    ctx.beginPath(); ctx.arc(e1x, e1y, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e2x, e2y, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(e1x, e1y, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e2x, e2y, 1, 0, Math.PI * 2); ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ────────────────────────────── Main loop ── */
  function loop(t) {
    raf = requestAnimationFrame(loop);
    var dt = Math.min(50, t - lastT);
    lastT = t;

    if (state === 'playing') {
      acc += dt;
      while (acc >= stepMs) {
        acc -= stepMs;
        step();
        if (state !== 'playing') break;
      }
      if (state === 'playing' && golden && t > goldenExpires) golden = false;
    }

    updateParticles(t, dt);
    render(t);
  }

  /* ────────────────────────────── Input ── */
  var KEY_DIRS = {
    ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
    W: { x: 0, y: -1 }, S: { x: 0, y: 1 }, A: { x: -1, y: 0 }, D: { x: 1, y: 0 }
  };

  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if (KEY_DIRS[k]) {
      if (state === 'playing') e.preventDefault();
      queueDir(KEY_DIRS[k]);
      if (state === 'menu' || state === 'over') e.preventDefault();
      return;
    }
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (state === 'menu' || state === 'over') startGame();
      else if (state === 'playing') pause();
      else if (state === 'paused') resume();
      return;
    }
    if (k === 'p' || k === 'P') {
      if (state === 'playing') { e.preventDefault(); pause(); }
      else if (state === 'paused') { e.preventDefault(); resume(); }
      return;
    }
    if (k === 'm' || k === 'M') {
      toggleSound();
      return;
    }
  });

  // Touch / pointer swipe on the board
  var touchStart = null;
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!touchStart || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - touchStart.x;
    var dy = e.touches[0].clientY - touchStart.y;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) queueDir({ x: dx > 0 ? 1 : -1, y: 0 });
    else queueDir({ x: 0, y: dy > 0 ? 1 : -1 });
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: false });

  canvas.addEventListener('touchend', function () { touchStart = null; });

  // pointer (mouse drag) as a bonus for desktop drag-to-steer
  var pointerDown = false, pointerStart = null;
  canvas.addEventListener('pointerdown', function (e) {
    pointerDown = true;
    pointerStart = { x: e.clientX, y: e.clientY };
    if (state === 'menu' || state === 'over') startGame();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pointerDown) return;
    var dx = e.clientX - pointerStart.x;
    var dy = e.clientY - pointerStart.y;
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
    if (Math.abs(dx) > Math.abs(dy)) queueDir({ x: dx > 0 ? 1 : -1, y: 0 });
    else queueDir({ x: 0, y: dy > 0 ? 1 : -1 });
    pointerStart = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', function () { pointerDown = false; });

  /* ────────────────────────────── UI wiring ── */
  startBtn.addEventListener('click', startGame);
  resumeBtn.addEventListener('click', resume);
  restartBtn.addEventListener('click', restart);
  replayBtn.addEventListener('click', restart);

  segBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setDifficulty(btn.getAttribute('data-diff'));
    });
  });

  wrapToggle.addEventListener('click', function () {
    wrapMode = !wrapMode;
    savePref('wrap', wrapMode);
    reflectSettingsUI();
  });

  muteBtn.addEventListener('click', toggleSound);

  canvas.addEventListener('click', function () {
    if (state === 'menu' || state === 'over') startGame();
  });

  window.addEventListener('resize', fitCanvas);

  function setDifficulty(d) {
    if (!DIFF[d]) return;
    difficulty = d;
    savePref('diff', d);
    reflectSettingsUI();
  }

  function reflectSettingsUI() {
    segBtns.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-diff') === difficulty);
    });
    wrapToggle.setAttribute('aria-checked', wrapMode ? 'true' : 'false');
    var text = wrapToggle.querySelector('.switch-text');
    if (text) text.textContent = wrapMode ? 'On' : 'Off';
  }

  function toggleSound() {
    soundOn = !soundOn;
    savePref('sound', soundOn);
    muteBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    muteBtn.textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off';
    if (soundOn) sndStart();
  }
})();
