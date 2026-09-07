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
  parts = parts.filter((p) => p.y < h + 60 && p.life < 900);
  for (const p of parts) {
    p.life++;
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.star) drawStar(0, 0, p.w * 0.75);
    else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  if (!parts.length) {
    cancelAnimationFrame(raf);
    raf = 0;
    ctx.clearRect(0, 0, w, h);
  }
}
