// Львёнок Лёва — конферансье. Рисуется целиком в SVG, поэтому не мылится на 4K.

function manePetals() {
  const cx = 100;
  const cy = 98;
  const r = 52;
  let out = '';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.98;
    const rr = i % 2 ? 17 : 20;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr}" fill="url(#maneG)"/>`;
  }
  return out;
}

function whiskers() {
  const rows = [
    [64, 116, 26, -7],
    [63, 124, 28, 1],
    [66, 132, 25, 8]
  ];
  let out = '';
  for (const [x, y, len, dy] of rows) {
    out += `<path d="M${x} ${y} q ${-len / 2} ${dy / 2} ${-len} ${dy}" stroke="#8a5a2b" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".65"/>`;
    out += `<path d="M${200 - x} ${y} q ${len / 2} ${dy / 2} ${len} ${dy}" stroke="#8a5a2b" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".65"/>`;
  }
  return out;
}

export function lionSvg() {
  return `
<svg class="lion" viewBox="0 0 200 268" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="maneG" cx="35%" cy="30%">
      <stop offset="0%" stop-color="#ffb547"/>
      <stop offset="60%" stop-color="#f08a1e"/>
      <stop offset="100%" stop-color="#d2670f"/>
    </radialGradient>
    <linearGradient id="faceG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe6b8"/>
      <stop offset="100%" stop-color="#ffc985"/>
    </linearGradient>
    <linearGradient id="coatG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8434f"/>
      <stop offset="100%" stop-color="#a3182a"/>
    </linearGradient>
    <linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff0b8"/>
      <stop offset="55%" stop-color="#ffc93c"/>
      <stop offset="100%" stop-color="#c98b12"/>
    </linearGradient>
  </defs>

  <!-- хвост -->
  <g class="tail">
    <path d="M136 216 q 34 6 42 -22" stroke="#f0a04a" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M172 196 q 12 -10 4 -22 q 10 12 2 24 z" fill="#d2670f"/>
    <circle cx="176" cy="192" r="10" fill="url(#maneG)"/>
  </g>

  <!-- ноги -->
  <ellipse class="foot-left" cx="82" cy="252" rx="15" ry="10" fill="#f0a04a"/>
  <ellipse class="foot-right" cx="118" cy="252" rx="15" ry="10" fill="#f0a04a"/>

  <!-- фрак -->
  <path d="M100 152 c -26 0 -38 14 -40 34 l -6 52 c -1 8 5 14 13 14 h 66 c 8 0 14 -6 13 -14 l -6 -52 c -2 -20 -14 -34 -40 -34 z" fill="url(#coatG)"/>
  <path d="M100 152 c -10 0 -17 3 -22 8 l 22 26 l 22 -26 c -5 -5 -12 -8 -22 -8 z" fill="#fdf3e0"/>
  <circle cx="100" cy="196" r="4.2" fill="url(#goldG)"/>
  <circle cx="100" cy="212" r="4.2" fill="url(#goldG)"/>
  <circle cx="100" cy="228" r="4.2" fill="url(#goldG)"/>

  <!-- лапы -->
  <g class="arm-wave">
    <path d="M64 172 c -16 4 -22 16 -20 30" stroke="#f0a04a" stroke-width="12" fill="none" stroke-linecap="round"/>
    <g class="lion-prop"></g>
    <circle cx="44" cy="204" r="10" fill="#ffc985"/>
  </g>
  <g class="arm-right"><path d="M136 172 c 16 4 22 16 20 30" stroke="#f0a04a" stroke-width="12" fill="none" stroke-linecap="round"/>
  <circle cx="156" cy="204" r="10" fill="#ffc985"/>
  </g>
  <g class="gift-ticket"><rect x="7" y="154" width="63" height="39" rx="5" fill="#fff0b9" stroke="#b68032" stroke-width="3"/><path d="M19 162v23" stroke="#c59a49" stroke-dasharray="3 3"/><text x="45" y="181" font-size="22" text-anchor="middle" fill="#bd8435">★</text></g>

  <!-- бабочка -->
  <path d="M100 160 l -16 -8 v 16 z" fill="url(#goldG)"/>
  <path d="M100 160 l 16 -8 v 16 z" fill="url(#goldG)"/>
  <circle cx="100" cy="160" r="4" fill="#c98b12"/>

  <!-- уши -->
  <g class="lion-head">
  <circle cx="58" cy="62" r="15" fill="#f0a04a"/>
  <circle cx="58" cy="62" r="7.5" fill="#ff9db4"/>
  <circle cx="142" cy="62" r="15" fill="#f0a04a"/>
  <circle cx="142" cy="62" r="7.5" fill="#ff9db4"/>

  <!-- грива -->
  <g class="mane">${manePetals()}</g>

  <!-- морда -->
  <circle cx="100" cy="98" r="42" fill="url(#faceG)"/>

  <!-- глаза -->
  <g>
    <ellipse cx="85" cy="92" rx="8.5" ry="9.5" fill="#fff"/>
    <circle cx="86" cy="93" r="5.2" fill="#2a1440"/>
    <circle cx="88" cy="90.5" r="1.9" fill="#fff"/>
    <ellipse class="eyelid" cx="85" cy="92" rx="9" ry="10" fill="url(#faceG)"/>
  </g>
  <g>
    <ellipse cx="115" cy="92" rx="8.5" ry="9.5" fill="#fff"/>
    <circle cx="116" cy="93" r="5.2" fill="#2a1440"/>
    <circle cx="118" cy="90.5" r="1.9" fill="#fff"/>
    <ellipse class="eyelid" cx="115" cy="92" rx="9" ry="10" fill="url(#faceG)"/>
  </g>
  <path d="M76 78 q 9 -6 18 -1" stroke="#c47a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M106 77 q 9 -5 18 1" stroke="#c47a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>

  <!-- щёки -->
  <circle cx="70" cy="112" r="7" fill="#ff9db4" opacity=".45"/>
  <circle cx="130" cy="112" r="7" fill="#ff9db4" opacity=".45"/>

  <!-- нос и рот -->
  <ellipse cx="89" cy="118" rx="14" ry="11" fill="#fff8ea"/>
  <ellipse cx="111" cy="118" rx="14" ry="11" fill="#fff8ea"/>
  <path d="M92 108 h 16 a 4 4 0 0 1 3 6 l -8 7 a 4 4 0 0 1 -6 0 l -8 -7 a 4 4 0 0 1 3 -6 z" fill="#c2455f"/>
  <path d="M100 122 v 5 M100 127 q -8 8 -15 1 M100 127 q 8 8 15 1" stroke="#8a5a2b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  ${whiskers()}

  <!-- цилиндр -->
  <g transform="rotate(-13 100 46)">
    <ellipse cx="100" cy="44" rx="40" ry="9" fill="#1b1030"/>
    <path d="M76 44 v -34 a 24 9 0 0 1 48 0 v 34 a 24 9 0 0 1 -48 0 z" fill="#2a1a45"/>
    <ellipse cx="100" cy="10" rx="24" ry="8" fill="#3a2560"/>
    <rect x="76" y="26" width="48" height="10" fill="#e03a45"/>
    <path d="M100 26 l 2.6 5.4 6 .8 -4.3 4.2 1 6 -5.3 -2.8 -5.3 2.8 1 -6 -4.3 -4.2 6 -.8 z" fill="url(#goldG)"/>
  </g>
  </g>
</svg>`;
}

// Реквизит в поднятой лапе: меняется под то, что сейчас происходит на арене.
const PROPS = {
  mic: `
    <rect x="40" y="196" width="8" height="18" rx="3" fill="#8B93A8"/>
    <rect x="34" y="168" width="20" height="32" rx="10" fill="#3A3F52"/>
    <path d="M38 172h12M38 178h12M38 184h12" stroke="#6B7484" stroke-width="2" stroke-linecap="round"/>`,
  star: `
    <rect x="41" y="186" width="6" height="30" rx="3" fill="#B07A4E"/>
    <circle cx="44" cy="178" r="17" fill="#FFC93C" stroke="#3A2350" stroke-width="3"/>
    <path d="m44 168 3 6.4 7 1-5 4.8 1.2 7-6.2-3.4-6.2 3.4 1.2-7-5-4.8 7-1z" fill="#fff"/>`,
  sticks: `
    <rect x="26" y="192" width="34" height="6" rx="3" fill="#C98B4B" transform="rotate(-24 43 195)"/>
    <rect x="26" y="200" width="34" height="6" rx="3" fill="#E0B58A" transform="rotate(-8 43 203)"/>`,
  whistle: `
    <rect x="40" y="196" width="7" height="16" rx="3" fill="#8B93A8"/>
    <path d="M28 178h22a8 8 0 0 1 0 16H36l-8 6z" fill="#E63946"/>
    <circle cx="44" cy="186" r="3" fill="#fff"/>`,
  ticket: `
    <rect x="26" y="176" width="38" height="26" rx="4" fill="#fff" stroke="#9B6BFF" stroke-width="3"
          transform="rotate(-12 45 189)"/>
    <path d="M33 186h22M33 193h14" stroke="#9B6BFF" stroke-width="3" stroke-linecap="round"
          transform="rotate(-12 45 189)"/>`
};

export function lionProp(name) {
  return PROPS[name] || '';
}

export function thoughtHtml(text) {
  return `
    <div class="thought">
      <div class="puff" style="width:5rem;height:5rem;top:-1.6rem;left:2rem"></div>
      <div class="puff" style="width:6.4rem;height:6.4rem;top:-2.4rem;left:6rem"></div>
      <div class="puff" style="width:4.6rem;height:4.6rem;top:-1.2rem;right:1.4rem"></div>
      <div class="puff" style="width:5.2rem;height:5.2rem;bottom:-1.4rem;left:4rem"></div>
      <div class="puff" style="width:4.4rem;height:4.4rem;bottom:-1.2rem;right:3rem"></div>
      <div class="body"><div class="text"></div></div>
      <div class="trail-1"></div>
      <div class="trail-2"></div>
      <div class="trail-3"></div>
    </div>`;
}

// Реплики по умолчанию, если у конкурса не задана своя.
export const LINES = {
  welcome: [
    'Дамы и господа! Сегодня на арене — самый очаровательный артист!',
    'Занимайте места, представление вот-вот начнётся!'
  ],
  guests: ['Знакомимся с труппой! Каждый сегодня — звезда арены.'],
  intro: ['Свет! Барабаны! Начинаем номер!'],
  question: ['Ну-ка, кто знает ответ? Не подглядывать!'],
  reveal: ['Та-дам! Вот как всё было на самом деле.'],
  leaderboard: ['Смотрим, кто у нас в лидерах!'],
  finale: ['Аплодисменты! Победитель получает приз!'],
  diploma: ['Диплом вручается лучшим из лучших!'],
  recap: ['Вот такой у нас получился вечер. Спасибо, что были рядом!']
};

export function pickLine(key, seedIndex) {
  const arr = LINES[key] || LINES.question;
  return arr[Math.abs(seedIndex || 0) % arr.length];
}
