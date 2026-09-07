// Интерфейсные иконки: один стиль, толщина 2, скруглённые концы, красятся currentColor.
// Рисуются один раз в скрытый спрайт, дальше вставляются через <use> — не дублируются и
// остаются чёткими на любом экране.

const P = {
  'arrow-left': '<path d="M20 12H4m0 0 6-6m-6 6 6 6"/>',
  'arrow-right': '<path d="M4 12h16m0 0-6-6m6 6-6 6"/>',
  'chevron-up': '<path d="m6 15 6-6 6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',

  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m4 12 6 6L20 6"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',

  eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.8"/>',
  'eye-off': '<path d="M4 4 20 20"/><path d="M9.6 6.4A9.7 9.7 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.3 3.7M6.4 8.3A17 17 0 0 0 2 12s3.6 6 10 6a9.9 9.9 0 0 0 2.8-.4"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4 4"/>',

  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.2 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.2 6.1-.9z"/>',
  'star-fill': '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.2 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.2 6.1-.9z" fill="currentColor" stroke="none"/>',
  'crown-fill': '<path d="M3 8.5 7.2 12 12 5.5 16.8 12 21 8.5V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="currentColor" stroke="none"/><circle cx="3" cy="8.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="21" cy="8.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="5" r="1.8" fill="currentColor" stroke="none"/>',
  sparkle: '<path d="M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9z"/><path d="M18.5 15.5 19.2 18l2.3.7-2.3.8-.7 2.5-.8-2.5-2.2-.8 2.2-.7z"/>',
  crown: '<path d="M3 8.5 7.2 12 12 5.5 16.8 12 21 8.5V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 15.5h18"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4.5v1.8A3.2 3.2 0 0 0 7.4 10M17 5.5h2.5v1.8A3.2 3.2 0 0 1 16.6 10"/><path d="M12 14v3m-3.5 3h7"/>',
  medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="M12 12.4l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L8.8 14.7l2.2-.3z"/><path d="M8.5 9 6.5 3.5M15.5 9l2-5.5"/>',
  gift: '<path d="M4 11h16v8.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5z"/><path d="M2.5 7.5h19V11h-19z"/><path d="M12 7.5V20"/><path d="M12 7.5S10.6 3 8.4 3a2.2 2.2 0 0 0 0 4.5zM12 7.5S13.4 3 15.6 3a2.2 2.2 0 0 1 0 4.5z"/>',
  ticket: '<path d="M3 7.5h18V11a2 2 0 0 0 0 4v3.5H3V15a2 2 0 0 0 0-4z"/><path d="M12 8v1.5m0 2.5v1.5m0 2.5V18"/>',
  tent: '<path d="M12 3.5 21.5 19h-19z"/><path d="M12 3.5V19M12 19l4-6M12 19l-4-6"/>',
  hat: '<path d="M8 15V6.5a4 1.8 0 0 1 8 0V15"/><path d="M3.5 15.5c0 1.4 3.8 2.5 8.5 2.5s8.5-1.1 8.5-2.5S16.7 13 12 13s-8.5 1.1-8.5 2.5Z"/><path d="M8 10h8"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.4a2.7 2.7 0 1 1 3.4 3.4c-.6.2-.8.7-.8 1.3v.4"/><circle cx="12" cy="17.2" r=".7" fill="currentColor"/>',
  masks: '<path d="M3 5.5h8.5v6A4.2 4.2 0 0 1 7.2 16 4.2 4.2 0 0 1 3 11.5z"/><path d="M12.5 8.5H21v6a4.2 4.2 0 0 1-8.5 0z"/><path d="M5.6 9h.01M8.9 9h.01M15.1 11.5h.01M18.4 11.5h.01"/>',
  balance: '<path d="M12 4.5v15M7.5 19.5h9"/><path d="M4 8.5h16"/><circle cx="12" cy="4.5" r="1.4"/><path d="M4 8.5 1.5 14a3.5 3.5 0 0 0 5 0zM20 8.5 22.5 14a3.5 3.5 0 0 1-5 0z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  quote: '<path d="M9.5 6.5C6.5 7.6 4.5 10 4.5 13v4.5h6V12H7.6c.2-1.6 1.2-2.8 2.9-3.5zM19.5 6.5C16.5 7.6 14.5 10 14.5 13v4.5h6V12h-2.9c.2-1.6 1.2-2.8 2.9-3.5z"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 4.6-4.4a1.6 1.6 0 0 1 2.2 0L15 17"/><path d="m13.5 14.4 1.7-1.6a1.6 1.6 0 0 1 2.2 0L20 15"/>',
  music: '<path d="M9 18V6.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  clapper: '<path d="M3 9.5h18V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3.6 9.5 3 6.2l17.4-2.1.6 3.3z"/><path d="m8.4 5.6 1 3.4M13.4 5 14.4 8.4"/>',
  drum: '<ellipse cx="12" cy="10" rx="8.5" ry="3.5"/><path d="M3.5 10v5c0 1.9 3.8 3.5 8.5 3.5s8.5-1.6 8.5-3.5v-5"/><path d="m5.5 12.5 3-2.2 3 2.2 3-2.2 3 2.2"/><path d="m17 19.5 3.5 2M7 19.5 3.5 21.5"/>',
  confetti: '<path d="M3.5 20.5 9 8l7 7z"/><path d="M14.5 3.5v2M19 5.5l-1.4 1.4M20.5 10h-2M18.5 14.5 17 13"/>',
  applause: '<path d="M10 20.5a4 4 0 0 1-4-4V9.8a1.4 1.4 0 0 1 2.8 0v3.4"/><path d="M8.8 12.6V7.4a1.4 1.4 0 0 1 2.8 0v5M11.6 12.4V8.2a1.4 1.4 0 0 1 2.8 0v4.2"/><path d="M14.4 12.4v-2.6a1.4 1.4 0 0 1 2.8 0v6.7a4 4 0 0 1-4 4h-3.2"/><path d="M4.5 5 3 3.5M7.5 3.2 7.2 5.2M18 4l1.6-1.4"/>',
  balloon: '<path d="M12 3a5 5.6 0 0 1 5 5.6c0 3.6-2.6 6.4-5 6.4S7 12.2 7 8.6A5 5.6 0 0 1 12 3Z"/><path d="m12 15 1 1.6h-2z"/><path d="M12 16.6c0 2-2 2-2 3.4"/>',

  play: '<path d="M7 4.8 19 12 7 19.2z"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  rewind: '<path d="M12 6v12L4 12z"/><path d="M21 6v12l-8-6z"/>',
  forward: '<path d="M12 6v12l8-6z"/><path d="M3 6v12l8-6z"/>',
  restart: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.5 3.5V9H15"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>',

  tv: '<rect x="2.5" y="4.5" width="19" height="13" rx="2"/><path d="M8 21h8M12 17.5V21"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 5.5h3"/><path d="M12 18.2h.01"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.6a6.5 6.5 0 0 1 4 5.4"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1.3" fill="currentColor"/><circle cx="4" cy="12" r="1.3" fill="currentColor"/><circle cx="4" cy="18" r="1.3" fill="currentColor"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  download: '<path d="M12 3.5v11m0 0 4-4m-4 4-4-4"/><path d="M4 16.5v2.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-2.5"/>',
  upload: '<path d="M12 20.5v-11m0 0 4 4m-4-4-4 4"/><path d="M4 16.5v2.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-2.5"/>',
  trash: '<path d="M4.5 6.5h15"/><path d="M9 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h3.4A1.3 1.3 0 0 1 15 4.8v1.7"/><path d="M6.5 6.5 7.4 20a1.3 1.3 0 0 0 1.3 1.2h6.6a1.3 1.3 0 0 0 1.3-1.2l.9-13.5"/><path d="M10.5 10.5v6.5M13.5 10.5v6.5"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 6.5 3 3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 5.1 5.1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3"/>',
  home: '<path d="M3.5 11 12 3.5l8.5 7.5"/><path d="M5.5 9.7V20h13V9.7"/><path d="M9.5 20v-5.5h5V20"/>',
  refresh: '<path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9L20.5 8.5"/><path d="M20.5 3.5v5h-5"/><path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3.5 15.5"/><path d="M3.5 20.5v-5h5"/>',
  save: '<path d="M4.5 4.5h11l4 4v11a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z"/><path d="M8 4.5v5h6v-5M8 20v-5.5h8V20"/>',
  file: '<path d="M6 3.5h7l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"/><path d="M13 3.5v5h5"/>',
  drag: '<circle cx="9" cy="6" r="1.4" fill="currentColor"/><circle cx="15" cy="6" r="1.4" fill="currentColor"/><circle cx="9" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="18" r="1.4" fill="currentColor"/><circle cx="15" cy="18" r="1.4" fill="currentColor"/>'
};

export const ICON_NAMES = Object.keys(P);

export function iconSprite() {
  const symbols = ICON_NAMES.map((name) =>
    `<symbol id="i-${name}" viewBox="0 0 24 24">` +
    `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name]}</g>` +
    '</symbol>').join('');
  return `<svg class="icon-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>`;
}

export function icon(name, cls) {
  return `<svg class="ic ${cls || ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

export function mountSprite() {
  if (document.querySelector('.icon-sprite')) return;
  document.body.insertAdjacentHTML('afterbegin', iconSprite());
}
