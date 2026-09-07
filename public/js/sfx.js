// Звук показа. Большие моменты — настоящие записи из media/sfx (их кладёт `npm run audio`),
// мелкие пики синтезируются на лету. Если файла нет — играет синтез, так что офлайн
// и пустая папка media ничего не ломают.
//
// Браузер разрешает звук только после первого клика или нажатия клавиши.

let ctx = null;
let master = null;
let ready = false;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    // Лимитер на выходе: без него сумма нескольких голосов уходит за единицу
    // и звук хрипит. Особенно заметно на аккордах в tada.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(limiter);
  }
  if (ctx.state === 'suspended') ctx.resume();
  ready = ctx.state === 'running';
  if (ready) preload();
  return ready;
}

export function isReady() { return ready && ctx && ctx.state === 'running'; }

// Фоновая музыка живёт в music.js, но ходит через тот же контекст и лимитер.
export function getContext() { return ctx; }
export function getMusicBus() { return master; }

// ——— синтез ———

function tone(freq, start, dur, type, gain, glideTo) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain || 0.25, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start, dur, gain, freq, q) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq || 900;
  filter.Q.value = q || 1;
  const g = ctx.createGain();
  // Короткая атака: без неё каждый всплеск начинается с полной амплитуды и щёлкает.
  const peak = gain || 0.2;
  const rise = Math.min(0.008, dur * 0.3);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + rise);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

const SOUNDS = {
  click() { tone(660, 0, 0.08, 'triangle', 0.18); },

  correct() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.32, 'triangle', 0.22));
    noise(0.34, 0.25, 0.06, 3200, 2);
  },

  wrong() {
    tone(320, 0, 0.22, 'sawtooth', 0.16, 180);
    tone(240, 0.16, 0.3, 'sawtooth', 0.13, 120);
  },

  point() {
    tone(880, 0, 0.1, 'triangle', 0.32);
    tone(1320, 0.07, 0.16, 'triangle', 0.26);
  },

  drumroll() {
    for (let i = 0; i < 34; i++) noise(i * 0.045, 0.05, 0.07 + i * 0.003, 220, 0.8);
    noise(1.55, 0.5, 0.22, 500, 0.6);
    tone(196, 1.55, 0.6, 'sine', 0.22);
  },

  tada() {
    const chord = [523.25, 659.25, 783.99];
    chord.forEach((f) => tone(f, 0, 0.18, 'square', 0.1));
    chord.forEach((f) => tone(f, 0.2, 0.16, 'square', 0.1));
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.42 + i * 0.02, 1.1, 'triangle', 0.13));
    noise(0.42, 0.9, 0.07, 2600, 1.2);
  },

  applause() {
    for (let i = 0; i < 90; i++) {
      noise(Math.random() * 2.2, 0.06, 0.03 + Math.random() * 0.03, 1400 + Math.random() * 2200, 1.5);
    }
  },

  whoosh() { noise(0, 0.45, 0.3, 700, 0.7); }
};

// ——— записи ———

// Файлы с Викисклада длинные: играем кусок с начала звука и мягко уводим в тишину,
// чтобы не резать на обрыве. Отдельный ffmpeg для этого не нужен.
const CLIP = {
  applause: { max: 3.4, fade: 1.0, gain: 2.2 },   // запись овации тихая, поднимаем
  drumroll: { max: 4.2, fade: 0.15, gain: 0.9 },
  tada: { max: 4.6, fade: 0.7, gain: 4 },        // фанфара записана тихо
  correct: { max: 2.5, fade: 0.3, gain: 1 },
  wrong: { max: 2.5, fade: 0.3, gain: 1 },
  point: { max: 1.5, fade: 0.2, gain: 1 },
  click: { max: 1, fade: 0.1, gain: 1 },
  whoosh: { max: 1.5, fade: 0.2, gain: 1 }
};

// Свои звуки: положи файл в media/sfx с именем звука (например media/sfx/tada.mp3)
// — он заменит синтезированный.
const custom = {};
const buffers = {};
const loading = {};
const playing = {};

export function useCustomSounds(files) {
  for (const f of files || []) {
    const m = /^sfx\/([\w-]+)\./.exec(f.name || '');
    if (m && SOUNDS[m[1]]) custom[m[1]] = f.path;
  }
  preload();
}

// Декодируем заранее и один раз: new Audio() на каждый вызов давал задержку
// первого воспроизведения и наложение инстансов друг на друга.
function load(name) {
  if (!ctx || buffers[name] || loading[name] || !custom[name]) return;
  loading[name] = fetch(custom[name])
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((raw) => ctx.decodeAudioData(raw))
    .then((buf) => { buffers[name] = buf; })
    .catch(() => { delete custom[name]; })   // не смогли — просто останемся на синтезе
    .finally(() => { delete loading[name]; });
}

function preload() {
  if (!ctx) return;
  for (const name of Object.keys(custom)) load(name);
}

// Многие записи начинаются с паузы — ищем, где реально начинается звук.
// Ответ один и тот же на всю жизнь буфера, поэтому считаем его один раз.
const offsets = new WeakMap();

function firstSound(buf) {
  if (offsets.has(buf)) return offsets.get(buf);
  const data = buf.getChannelData(0);
  let found = 0;
  for (let i = 0; i < data.length; i += 64) {
    if (Math.abs(data[i]) > 0.02) { found = Math.max(0, i / buf.sampleRate - 0.02); break; }
  }
  offsets.set(buf, found);
  return found;
}

function playBuffer(name, buf) {
  const clip = CLIP[name] || { max: 4, fade: 0.3, gain: 1 };
  const offset = firstSound(buf);
  const dur = Math.min(clip.max, Math.max(0.1, buf.duration - offset));
  const t = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  const fade = Math.min(clip.fade, dur * 0.5);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(clip.gain, t + 0.01);
  g.gain.setValueAtTime(clip.gain, t + dur - fade);
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(g).connect(master);

  // Второе нажатие подряд не должно накладываться само на себя.
  if (playing[name]) { try { playing[name].stop(); } catch (e) { /* уже кончился */ } }
  playing[name] = src;
  src.onended = () => { if (playing[name] === src) delete playing[name]; };

  src.start(t, offset, dur);
}

export function play(name) {
  if (!isReady()) return;
  if (buffers[name]) { playBuffer(name, buffers[name]); return; }
  if (custom[name]) load(name);       // ещё качается — в этот раз играем синтез
  const fn = SOUNDS[name];
  if (fn) fn();
}
