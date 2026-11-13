'use strict';

// AIFarabi cyberpunk presentation — no third-party JavaScript dependencies.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hero = document.querySelector('.hero');
const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const light = document.getElementById('cursorLight');
const pointer = { x: -10000, y: -10000, inside: false };
let W = 0, H = 0, DPR = 1, frameId = 0, t = 0, heroVisible = true;
let lastFrame = 0;

function resizeCanvas() {
  const rect = hero.getBoundingClientRect();
  W = Math.max(1, rect.width);
  H = Math.max(1, rect.height);
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawGrid();
}

function gridPoint(c, r, cols, rows, now) {
  // Perspective rows converge toward horizon at 45% of the screen.
  const depth = r / rows;
  const spread = Math.pow(depth, 1.65);
  const xNorm = c / cols;
  const horizon = H * 0.47;
  const yBase = horizon + (H * 0.54) * spread;
  const x = (xNorm - .5) * W * (0.79 + .45 * depth) + W / 2;
  const wave = Math.sin(xNorm * 9.7 + now * .55 + depth * 5.1) * (8 + depth * 32)
             + Math.sin(xNorm * 17.4 - now * .34 + depth * 2.5) * (3 + depth * 12);
  let px = x, py = yBase + wave;
  if (pointer.inside && !reducedMotion.matches) {
    const dx = px - pointer.x;
    const dy = py - pointer.y;
    const dist = Math.hypot(dx, dy);
    const radius = Math.min(250, Math.max(160, W * .19));
    if (dist < radius) {
      // Radial magnification: fish-eye dilation of nearby mesh vertices.
      const strength = Math.pow(1 - dist / radius, 2) * .47;
      px += dx * strength;
      py += dy * strength;
    }
  }
  return { x: px, y: py, depth };
}

function drawGrid() {
  if (!ctx || !W || !H) return;
  ctx.clearRect(0, 0, W, H);
  const mobile = W < 620;
  const cols = mobile ? 22 : 43;
  const rows = mobile ? 17 : 25;
  const points = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) row.push(gridPoint(c, r, cols, rows, t));
    points.push(row);
  }
  // Layered lines: distant violet and foreground ice-blue.
  ctx.lineWidth = mobile ? .65 : .85;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    points[r].forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    const a = .22 + .49 * (r / rows);
    ctx.strokeStyle = r < rows * .45 ? `rgba(76,93,215,${a})` : `rgba(104,162,235,${a})`;
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    points.forEach((row, i) => i ? ctx.lineTo(row[c].x, row[c].y) : ctx.moveTo(row[c].x, row[c].y));
    ctx.strokeStyle = `rgba(104,162,235,${mobile ? .27 : .38})`;
    ctx.stroke();
  }
  // Nodes with soft halos; glow increases closer to the cursor.
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      if (r % 2 && c % 2) continue;
      const p = points[r][c];
      const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
      const near = pointer.inside ? Math.max(0, 1 - d / 200) : 0;
      const alpha = .38 + p.depth * .45 + near * .16;
      const rad = (mobile ? .7 : 1) + p.depth * 1.25 + near * 1.5;
      ctx.beginPath();
      ctx.fillStyle = `rgba(104,162,235,${alpha * .18})`;
      ctx.arc(p.x, p.y, rad * 3.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = `rgba(202,228,255,${Math.min(1, alpha)})`;
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Atmospheric fade at top/bottom, retaining the visible front grid.
  const fade = ctx.createLinearGradient(0, H * .39, 0, H);
  fade.addColorStop(0, 'rgba(15,4,36,.70)');
  fade.addColorStop(.16, 'rgba(15,4,36,.15)');
  fade.addColorStop(.72, 'rgba(15,4,36,0)');
  fade.addColorStop(1, 'rgba(15,4,36,.40)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, H * .39, W, H * .61);
}

function animateGrid(timestamp) {
  if (!heroVisible || document.hidden || reducedMotion.matches) { frameId = 0; return; }
  if (timestamp - lastFrame >= 32) { // ~30 FPS saves battery on presentation laptops
    t = timestamp / 1000;
    drawGrid();
    lastFrame = timestamp;
  }
  frameId = requestAnimationFrame(animateGrid);
}
function startGrid() {
  if (!frameId && heroVisible && !document.hidden && !reducedMotion.matches) {
    frameId = requestAnimationFrame(animateGrid);
  } else if (reducedMotion.matches) drawGrid();
}
function stopGrid() { if (frameId) cancelAnimationFrame(frameId); frameId = 0; }

if (ctx) {
  resizeCanvas();
  startGrid();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  const heroWatcher = new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
    heroVisible ? startGrid() : stopGrid();
  }, { threshold: 0 });
  heroWatcher.observe(hero);
  document.addEventListener('visibilitychange', () => document.hidden ? stopGrid() : startGrid());
  reducedMotion.addEventListener('change', () => { stopGrid(); drawGrid(); startGrid(); });
}

hero.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  const rect = hero.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
  pointer.inside = true;
  light.style.left = `${pointer.x}px`;
  light.style.top = `${pointer.y}px`;
  hero.classList.add('is-hovering');
  if (reducedMotion.matches) drawGrid();
}, { passive: true });
hero.addEventListener('pointerleave', () => {
  pointer.inside = false;
  hero.classList.remove('is-hovering');
}, { passive: true });

// Progressive reveal: stagger per group, but do not block accessibility.
const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -45px 0px', threshold: .08 });
  reveals.forEach(el => revealObserver.observe(el));
} else reveals.forEach(el => el.classList.add('visible'));

const progress = document.getElementById('scrollProgress');
const header = document.getElementById('siteHeader');
const sectionLinks = [...document.querySelectorAll('.desktop-nav a')];
const sections = [...document.querySelectorAll('main section[id]')];
let scrollQueued = false;
function updateScrollUI() {
  const available = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${available > 0 ? window.scrollY / available * 100 : 0}%`;
  header.classList.toggle('scrolled', window.scrollY > 25);
  let current = 'home';
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= window.innerHeight * .45) current = section.id;
  }
  sectionLinks.forEach(a => {
    const active = a.getAttribute('href') === `#${current}`;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
  scrollQueued = false;
}
window.addEventListener('scroll', () => {
  if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScrollUI); }
}, { passive: true });
updateScrollUI();

const menuToggle = document.getElementById('menuToggle');
const mobileNav = document.getElementById('mobileNav');
function closeMenu() {
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Мәзірді ашу');
  mobileNav.hidden = true;
}
menuToggle.addEventListener('click', () => {
  const next = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(next));
  menuToggle.setAttribute('aria-label', next ? 'Мәзірді жабу' : 'Мәзірді ашу');
  mobileNav.hidden = !next;
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
window.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
window.addEventListener('resize', () => { if (window.innerWidth > 850) closeMenu(); }, { passive: true });

// Conceptual for-loop animation (intentionally a simulation, not Python execution).
const runButton = document.getElementById('runDemo');
const resetButton = document.getElementById('resetDemo');
const currentValue = document.getElementById('currentValue');
const consoleOutput = document.getElementById('consoleOutput');
const dots = [...document.querySelectorAll('#valueDots span')];
let timer = null;
let value = 0;
function renderStep() {
  currentValue.textContent = value || '—';
  dots.forEach((dot, index) => dot.classList.toggle('done', index < value));
}
function resetDemo() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  value = 0;
  renderStep();
  consoleOutput.textContent = 'Бағдарламаны іске қосыңыз.';
  runButton.disabled = false;
  runButton.textContent = '▶ ІСКЕ ҚОСУ';
}
function runDemo() {
  if (timer !== null) return;
  value = 0;
  renderStep();
  consoleOutput.textContent = '';
  runButton.disabled = true;
  runButton.textContent = 'ОРЫНДАЛУДА...';
  const step = () => {
    value++;
    renderStep();
    consoleOutput.textContent += `${value}\n`;
    if (value === 5) {
      clearInterval(timer);
      timer = null;
      runButton.disabled = false;
      runButton.textContent = '▶ ҚАЙТА ІСКЕ ҚОСУ';
    }
  };
  step();
  if (value < 5) timer = setInterval(step, 740);
}
runButton.addEventListener('click', runDemo);
resetButton.addEventListener('click', resetDemo);
