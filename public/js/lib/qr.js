// Минимальный генератор QR-кода: режим байтов, уровень коррекции L, версии 1–5.
// Этого с запасом хватает на адрес вида http://192.168.1.42:1717/remote.
// Возвращает матрицу true/false и готовый SVG.

const CAP = {
  1: { total: 26, ecc: 7, align: 0 },
  2: { total: 44, ecc: 10, align: 18 },
  3: { total: 70, ecc: 15, align: 22 },
  4: { total: 100, ecc: 20, align: 26 },
  5: { total: 134, ecc: 26, align: 30 }
};

// ——— арифметика в GF(256) ———

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a, b) {
  if (!a || !b) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, eccLen) {
  const gen = rsGenerator(eccLen);
  const res = new Array(eccLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < eccLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

// ——— сборка потока данных ———

function encodeData(text, version) {
  const bytes = new TextEncoder().encode(text);
  const { total, ecc } = CAP[version];
  const dataCap = total - ecc;
  const bits = [];
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  const cap = dataCap * 8;
  if (bits.length > cap) return null;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const words = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    words.push(v);
  }
  const pads = [0xec, 0x11];
  let p = 0;
  while (words.length < dataCap) words.push(pads[p++ % 2]);
  return words.concat(rsEncode(words, ecc));
}

// ——— матрица ———

function makeMatrix(version) {
  const size = 17 + version * 4;
  const m = [];
  const fixed = [];
  for (let i = 0; i < size; i++) {
    m.push(new Array(size).fill(false));
    fixed.push(new Array(size).fill(false));
  }
  const setF = (r, c, v) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    m[r][c] = v;
    fixed[r][c] = true;
  };

  const finder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const on = inner && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setF(row + r, col + c, on);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setF(6, i, i % 2 === 0);
    setF(i, 6, i % 2 === 0);
  }

  const a = CAP[version].align;
  if (a) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        setF(a + r, a + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
      }
    }
  }

  setF(size - 8, 8, true); // тёмный модуль

  // резерв под информацию о формате
  for (let i = 0; i < 9; i++) {
    if (i !== 6) { fixed[8][i] = true; fixed[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    fixed[8][size - 1 - i] = true;
    fixed[size - 1 - i][8] = true;
  }

  return { m, fixed, size };
}

function placeData(m, fixed, size, words) {
  const bits = [];
  for (const w of words) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);
  let bi = 0;
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (fixed[row][c]) continue;
        m[row][c] = bi < bits.length ? bits[bi++] === 1 : false;
      }
    }
    up = !up;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

function applyMask(m, fixed, size, maskId) {
  const out = m.map((row) => row.slice());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!fixed[r][c] && MASKS[maskId](r, c)) out[r][c] = !out[r][c];
    }
  }
  return out;
}

function formatBits(maskId) {
  const data = (0b01 << 3) | maskId; // уровень L = 01
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  }
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
}

function drawFormat(m, size, maskId) {
  const bits = formatBits(maskId);
  const get = (i) => ((bits >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) m[i][8] = get(i);
  m[7][8] = get(6);
  m[8][8] = get(7);
  m[8][7] = get(8);
  for (let i = 9; i <= 14; i++) m[8][14 - i] = get(i);
  for (let i = 0; i <= 7; i++) m[8][size - 1 - i] = get(i);
  for (let i = 8; i <= 14; i++) m[size - 15 + i][8] = get(i);
  m[size - 8][8] = true;
}

function penalty(m, size) {
  let score = 0;
  const runScore = (line) => {
    let run = 1;
    for (let i = 1; i < size; i++) {
      if (line[i] === line[i - 1]) { run++; } else { if (run >= 5) score += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) score += 3 + (run - 5);
  };
  for (let r = 0; r < size; r++) runScore(m[r]);
  for (let c = 0; c < size; c++) runScore(m.map((row) => row[c]));
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

export function qrMatrix(text) {
  for (let version = 1; version <= 5; version++) {
    const words = encodeData(text, version);
    if (!words) continue;
    const { m, fixed, size } = makeMatrix(version);
    placeData(m, fixed, size, words);
    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      const cand = applyMask(m, fixed, size, mask);
      drawFormat(cand, size, mask);
      const p = penalty(cand, size);
      if (!best || p < best.p) best = { p, m: cand };
    }
    return { size, modules: best.m };
  }
  return null;
}

export function qrSvg(text, opts) {
  const o = opts || {};
  const qr = qrMatrix(text);
  if (!qr) return '';
  const quiet = o.quiet === undefined ? 3 : o.quiet;
  const dim = qr.size + quiet * 2;
  const dark = o.dark || '#150c31';
  const light = o.light || '#fdf3e0';
  let path = '';
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return `<svg viewBox="0 0 ${dim} ${dim}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" class="qr">` +
    `<rect width="${dim}" height="${dim}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
