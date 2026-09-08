// Конфетти на canvas: цирковые ленточки и звёздочки.

const COLORS = ['#ffc93c', '#e03a45', '#2fc6bf', '#ff7fb0', '#fdf3e0', '#57c96b', '#9b7bff'];

let canvas = null;
let ctx = null;
let parts = [];
let raf = 0;

// Размер в CSS-пикселях держим в переменных: читать clientWidth каждый кадр — лишний reflow.
let cw = 0;
let ch = 0;

export function init(el) {
  canvas = el;
  ctx = canvas.getContext('2d');
  resize();
  // ResizeObserver ловит и вход в полный экран, где window resize стреляет не всегда.
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
}

function resize() {
  if (!canvas) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  cw = w;
  ch = h;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width === bw && canvas.height === bh) return; // не сбрасываем живые частицы
  canvas.width = bw;
  canvas.height = bh;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// На большом экране той же горсти конфетти мало — добавляем по ширине.
function density() {
  return Math.min(2, Math.max(1, cw / 1280));
}

function spawn(n, opts) {
  if (!cw || !ch) resize();
  const w = cw;
  const h = ch;
  for (let i = 0; i < n; i++) {
    const fromBottom = opts && opts.fountain;
    parts.push({
      x: opts && opts.x !== undefined ? opts.x : Math.random() * w,
      y: fromBottom ? h + 10 : -20 - Math.random() * h * 0.4,
      vx: (Math.random() - 0.5) * (fromBottom ? 6 : 2.2),
      vy: fromBottom ? -(8 + Math.random() * 7) : 2 + Math.random() * 3.5,
      g: 0.14 + Math.random() * 0.08,
      w: 6 + Math.random() * 9,
      h: 9 + Math.random() * 12,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.28,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      star: Math.random() < 0.22,
      life: 0
    });
  }
  if (!raf) loop();
}

export function burst(n) { if (ctx) spawn(Math.round((n || 90) * density())); }
export function fountain(n) { if (ctx) spawn(Math.round((n || 140) * density()), { fountain: true }); }

// Мыльные пузыри: медленно вверх, слегка виляют и лопаются под потолком.
export function bubbles(n) {
  if (!ctx) return;
  if (!cw || !ch) resize();
  const count = Math.round((n || 26) * density());
  for (let i = 0; i < count; i++) {
    parts.push({
      x: Math.random() * cw,
      y: ch + 20 + Math.random() * ch * 0.3,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(0.8 + Math.random() * 1.4),
      g: -0.004,
      w: 10 + Math.random() * 26,
      h: 0,
      rot: Math.random() * Math.PI * 2,
      vr: 0.02 + Math.random() * 0.03,
      color: 'rgba(255,255,255,0.85)',
      kind: 'bubble',
      rise: true,
      life: 0
    });
  }
  if (!raf) loop();
}

// Серпантин: длинные ленты, падают медленнее конфетти и сильнее вертятся.
export function streamers(n) {
  if (!ctx) return;
  if (!cw || !ch) resize();
  const count = Math.round((n || 24) * density());
  for (let i = 0; i < count; i++) {
    parts.push({
      x: Math.random() * cw,
      y: -30 - Math.random() * ch * 0.5,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 1.2 + Math.random() * 1.6,
      g: 0.02,
      w: 4 + Math.random() * 4,
      h: 40 + Math.random() * 70,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.12,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 0
    });
  }
  if (!raf) loop();
}

// Сердечки — для тёплых номеров: летят снизу вверх.
export function hearts(n, x) {
  if (!ctx) return;
  if (!cw || !ch) resize();
  const count = Math.round((n || 12) * density());
  for (let i = 0; i < count; i++) {
    parts.push({
      x: x === undefined ? Math.random() * cw : x + (Math.random() - 0.5) * 80,
      y: ch + 20,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -(2 + Math.random() * 2.5),
      g: 0.012,
      w: 12 + Math.random() * 14,
      h: 0,
      rot: (Math.random() - 0.5) * 0.4,
      vr: (Math.random() - 0.5) * 0.03,
      color: Math.random() < 0.5 ? '#ff7fb0' : '#e03a45',
      kind: 'heart',
      rise: true,
      life: 0
    });
  }
  if (!raf) loop();
}

export function sparkleAt(x, y, n) {
  if (!ctx) return;
  for (let i = 0; i < (n || 18); i++) {
    parts.push({
      x, y,
      vx: (Math.random() - 0.5) * 9,
      vy: -3 - Math.random() * 7,
      g: 0.22,
      w: 5 + Math.random() * 6,
      h: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: Math.random() < 0.6 ? '#ffc93c' : '#fdf3e0',
      star: true,
      life: 0
    });
  }
  if (!raf) loop();
}

function drawBubble(r) {
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.stroke();
  // Блик — без него шар не читается как мыльный пузырь.
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.34, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
}

function drawHeart(r) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.75);
  ctx.bezierCurveTo(-r * 1.3, -r * 0.2, -r * 0.5, -r * 1.1, 0, -r * 0.35);
  ctx.bezierCurveTo(r * 0.5, -r * 1.1, r * 1.3, -r * 0.2, 0, r * 0.75);
  ctx.closePath();
  ctx.fill();
}

function drawStar(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function loop() {
  raf = requestAnimationFrame(loop);
  const w = cw;
  const h = ch;
  ctx.clearRect(0, 0, w, h);
  // Что летит вверх, уходит за верхний край; остальное — за нижний.
  parts = parts.filter((p) => p.life < 900 && (p.rise ? p.y > -80 : p.y < h + 60));
  for (const p of parts) {
    p.life++;
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    // Пузырь виляет: прямая линия вверх выглядит неживой.
    if (p.kind === 'bubble') p.x += Math.sin(p.life * 0.05) * 0.6;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.kind === 'bubble') drawBubble(p.w * 0.5);
    else if (p.kind === 'heart') drawHeart(p.w * 0.5);
    else if (p.star) drawStar(0, 0, p.w * 0.75);
    else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  if (!parts.length) {
    cancelAnimationFrame(raf);
    raf = 0;
    ctx.clearRect(0, 0, w, h);
  }
}
