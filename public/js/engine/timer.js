// Таймер конкурса — один на все страницы.
//
// Сервер не тикает: он хранит только момент, когда время выйдет. Каждая
// страница считает остаток сама, по часам сервера (bus.serverNow), поэтому
// телевизор, пульт и телефоны показывают одну и ту же цифру, а по сети не
// идёт ни одного кадра в секунду.
//
// Про истечение сообщает телевизор — единственная страница, которая всегда
// открыта. Сервер применяет это идемпотентно по номеру запуска, так что
// второй экран или пульт ничего не сломают.

import { serverNow } from '../bus.js';

const R = 52;                       // радиус кольца в системе координат SVG
const CIRC = 2 * Math.PI * R;
const WARN_AT = 3;                  // за сколько секунд начинаем тикать

let box = null;
let timer = null;
let hooks = {};
let raf = 0;
let lastWhole = -1;
let reportedSeq = 0;

export function leftMs(t) {
  if (!t) return 0;
  if (!t.running) return Math.max(0, Number(t.leftPaused) || 0);
  return Math.max(0, t.endsAt - serverNow());
}

export function leftSeconds(t) {
  return Math.ceil(leftMs(t) / 1000);
}

// Цифра для пульта и телефона: «1:05» или «45».
export function clock(t) {
  const s = leftSeconds(t);
  if (s < 60) return String(s);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function mount(node, callbacks) {
  box = node;
  hooks = callbacks || {};
  if (!box) return;
  box.innerHTML = `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="t-track" cx="60" cy="60" r="${R}"></circle>
      <circle class="t-fill" cx="60" cy="60" r="${R}"
              stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="0"></circle>
    </svg>
    <div class="t-num"></div>
    <div class="t-label"></div>`;
}

// Новое состояние с сервера.
export function update(runtime) {
  const next = (runtime && runtime.timer) || null;
  const changed = !next || !timer || next.seq !== timer.seq;
  timer = next;
  if (changed) lastWhole = -1;
  if (!timer) {
    stop();
    return;
  }
  if (!raf) loop();
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (box) box.hidden = true;
}

function loop() {
  raf = requestAnimationFrame(loop);
  if (!timer) { stop(); return; }

  const ms = leftMs(timer);
  const whole = Math.ceil(ms / 1000);
  const total = Math.max(1, Number(timer.seconds) || 1);
  const frac = Math.max(0, Math.min(1, ms / (total * 1000)));

  if (box) {
    box.hidden = false;
    box.classList.toggle('is-paused', !timer.running);
    box.classList.toggle('is-warn', timer.running && whole <= WARN_AT && whole > 0);
    box.classList.toggle('is-over', whole <= 0);
    const fill = box.querySelector('.t-fill');
    if (fill) fill.setAttribute('stroke-dashoffset', (CIRC * (1 - frac)).toFixed(1));
    const num = box.querySelector('.t-num');
    if (num) num.textContent = clock(timer);
    const label = box.querySelector('.t-label');
    if (label) label.textContent = timer.label || '';
  }

  if (whole !== lastWhole) {
    const was = lastWhole;
    lastWhole = whole;
    // Первый кадр после подключения не должен пикать задним числом.
    if (was >= 0 && timer.running) {
      if (whole > 0 && whole <= WARN_AT && hooks.tick) hooks.tick(whole);
      if (whole <= 0) {
        if (hooks.end) hooks.end();
        // Сообщаем серверу один раз на запуск.
        if (hooks.done && reportedSeq !== timer.seq) {
          reportedSeq = timer.seq;
          hooks.done(timer.seq);
        }
      }
    }
  }
}
