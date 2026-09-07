// Аватары гостей — двенадцать зверей-артистов цирка.
// Рисуются в одной манере с львёнком Лёвой: круглая голова, глаза с бликом, румянец.

const EYE = (lx, rx, y, r) => `
  <ellipse cx="${lx}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="#2A1A3E"/>
  <circle cx="${lx + r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.34}" fill="#fff"/>
  <ellipse cx="${rx}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="#2A1A3E"/>
  <circle cx="${rx + r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.34}" fill="#fff"/>`;

const BLUSH = (lx, rx, y, r, color) => `
  <circle cx="${lx}" cy="${y}" r="${r}" fill="${color || '#FF7BAC'}" opacity=".38"/>
  <circle cx="${rx}" cy="${y}" r="${r}" fill="${color || '#FF7BAC'}" opacity=".38"/>`;

const SMILE = (y, w) => `
  <path d="M50 ${y}v3.5M50 ${y + 3.5}c-${w} ${w * 0.9} -${w * 1.9} .3 -${w * 1.9} -${w * 0.5}
           M50 ${y + 3.5}c${w} ${w * 0.9} ${w * 1.9} .3 ${w * 1.9} -${w * 0.5}"
        stroke="#6B4A2B" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;

const A = {
  elephant: {
    ru: 'Слон',
    color: '#9FB3C8',
    svg: `
      <ellipse cx="18" cy="50" rx="17" ry="21" fill="#8FA6BE"/>
      <ellipse cx="82" cy="50" rx="17" ry="21" fill="#8FA6BE"/>
      <ellipse cx="19" cy="50" rx="10" ry="13" fill="#B9C9DA"/>
      <ellipse cx="81" cy="50" rx="10" ry="13" fill="#B9C9DA"/>
      <circle cx="50" cy="48" r="32" fill="#A9BDD2"/>
      ${EYE(38, 62, 44, 6)}
      <path d="M42 62h16v14a8 8 0 0 1-16 0z" fill="#93A9C0"/>
      <path d="M44 76c0 8 12 8 12 0" fill="#93A9C0"/>
      <path d="M44 68h12M44 73h12" stroke="#7E93A9" stroke-width="2" stroke-linecap="round"/>
      ${BLUSH(28, 72, 60, 6.5)}`
  },

  bear: {
    ru: 'Медвежонок',
    color: '#B07A4E',
    svg: `
      <circle cx="24" cy="24" r="14" fill="#8A5A34"/>
      <circle cx="76" cy="24" r="14" fill="#8A5A34"/>
      <circle cx="24" cy="24" r="7" fill="#D9A87E"/>
      <circle cx="76" cy="24" r="7" fill="#D9A87E"/>
      <circle cx="50" cy="52" r="34" fill="#B07A4E"/>
      ${EYE(38, 62, 46, 6)}
      <ellipse cx="50" cy="66" rx="17" ry="13" fill="#E8CBA8"/>
      <ellipse cx="50" cy="60" rx="7" ry="5" fill="#3A2350"/>
      ${SMILE(65, 4)}
      ${BLUSH(26, 74, 62, 7)}`
  },

  panda: {
    ru: 'Панда',
    color: '#EDEFF3',
    svg: `
      <circle cx="24" cy="24" r="13" fill="#2A2E39"/>
      <circle cx="76" cy="24" r="13" fill="#2A2E39"/>
      <circle cx="50" cy="52" r="34" fill="#F5F7FA"/>
      <ellipse cx="36" cy="46" rx="11" ry="13" fill="#2A2E39" transform="rotate(-14 36 46)"/>
      <ellipse cx="64" cy="46" rx="11" ry="13" fill="#2A2E39" transform="rotate(14 64 46)"/>
      <circle cx="37" cy="46" r="5" fill="#fff"/>
      <circle cx="63" cy="46" r="5" fill="#fff"/>
      <circle cx="38.4" cy="44.6" r="1.8" fill="#2A1A3E"/>
      <circle cx="64.4" cy="44.6" r="1.8" fill="#2A1A3E"/>
      <ellipse cx="50" cy="64" rx="14" ry="10" fill="#fff"/>
      <ellipse cx="50" cy="60" rx="6.5" ry="4.6" fill="#2A2E39"/>
      ${SMILE(64, 3.6)}`
  },

  fox: {
    ru: 'Лисёнок',
    color: '#FF8A3D',
    svg: `
      <path d="M22 12 40 34 16 42z" fill="#E8732A"/>
      <path d="M78 12 60 34 84 42z" fill="#E8732A"/>
      <path d="M25 19 37 33 22 37z" fill="#FFC2A0"/>
      <path d="M75 19 63 33 78 37z" fill="#FFC2A0"/>
      <circle cx="50" cy="52" r="33" fill="#FF8A3D"/>
      <path d="M50 30c14 0 22 12 22 24s-10 22-22 22-22-10-22-22 8-24 22-24Z" fill="#FFF1E2"/>
      ${EYE(38, 62, 46, 6)}
      <path d="M50 62c-4 0-6 2.4-6 4.6 0 2 2.6 3.4 6 3.4s6-1.4 6-3.4c0-2.2-2-4.6-6-4.6Z" fill="#3A2350"/>
      ${SMILE(70, 3.6)}
      ${BLUSH(28, 72, 60, 6.5)}`
  },

  tiger: {
    ru: 'Тигрёнок',
    color: '#FFA23D',
    svg: `
      <circle cx="24" cy="26" r="12" fill="#E8862A"/>
      <circle cx="76" cy="26" r="12" fill="#E8862A"/>
      <circle cx="24" cy="26" r="6" fill="#FFC9A0"/>
      <circle cx="76" cy="26" r="6" fill="#FFC9A0"/>
      <circle cx="50" cy="52" r="34" fill="#FFA23D"/>
      <path d="M50 22v7M41 24l1.5 6.5M59 24l-1.5 6.5" stroke="#3A2350" stroke-width="4" stroke-linecap="round"/>
      <path d="M19 44q6 1.5 9 1M19 56q6 -1 9 -2.5M81 44q-6 1.5 -9 1M81 56q-6 -1 -9 -2.5"
            stroke="#3A2350" stroke-width="4" stroke-linecap="round" fill="none"/>
      ${EYE(38, 62, 46, 6)}
      <ellipse cx="50" cy="66" rx="16" ry="12" fill="#FFF1E2"/>
      <path d="M50 58c-4 0-6.4 2.2-6.4 4.4 0 2 2.8 3.6 6.4 3.6s6.4-1.6 6.4-3.6c0-2.2-2.4-4.4-6.4-4.4Z" fill="#E05A6B"/>
      ${SMILE(66, 3.6)}
      ${BLUSH(28, 72, 62, 6)}`
  },

  zebra: {
    ru: 'Зебра',
    color: '#F1F3F6',
    svg: `
      <ellipse cx="26" cy="24" rx="8" ry="11" fill="#E7EAEF" transform="rotate(-18 26 24)"/>
      <ellipse cx="74" cy="24" rx="8" ry="11" fill="#E7EAEF" transform="rotate(18 74 24)"/>
      <ellipse cx="26" cy="25" rx="4" ry="6" fill="#C7CED8" transform="rotate(-18 26 25)"/>
      <ellipse cx="74" cy="25" rx="4" ry="6" fill="#C7CED8" transform="rotate(18 74 25)"/>
      <circle cx="50" cy="52" r="33" fill="#F7F9FC"/>
      <path d="M44 22q6 -3 12 0" stroke="#2A2E39" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M38 26q12 -5 24 0" stroke="#2A2E39" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M20 44q6 2 10 1M20 56q6 -1 10 -3M80 44q-6 2 -10 1M80 56q-6 -1 -10 -3"
            stroke="#2A2E39" stroke-width="4.5" stroke-linecap="round" fill="none"/>
      ${EYE(38, 62, 47, 6)}
      <ellipse cx="50" cy="68" rx="14" ry="10.5" fill="#D8DDE6"/>
      <ellipse cx="45" cy="65.5" rx="2.8" ry="2.1" fill="#2A2E39"/>
      <ellipse cx="55" cy="65.5" rx="2.8" ry="2.1" fill="#2A2E39"/>
      <path d="M44.5 72q5.5 3 11 0" stroke="#2A2E39" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    `
  },

  monkey: {
    ru: 'Обезьянка',
    color: '#A0703F',
    svg: `
      <circle cx="16" cy="52" r="13" fill="#8A5A34"/>
      <circle cx="84" cy="52" r="13" fill="#8A5A34"/>
      <circle cx="16" cy="52" r="7" fill="#E0B58A"/>
      <circle cx="84" cy="52" r="7" fill="#E0B58A"/>
      <circle cx="50" cy="50" r="32" fill="#A0703F"/>
      <path d="M50 26c15 0 24 12 24 24S64 76 50 76 26 62 26 50s9-24 24-24Z" fill="#E8C9A5"/>
      ${EYE(39, 61, 44, 6)}
      <ellipse cx="46" cy="58" rx="2.6" ry="2" fill="#6B4A2B"/>
      <ellipse cx="54" cy="58" rx="2.6" ry="2" fill="#6B4A2B"/>
      <path d="M40 66c5 6 15 6 20 0" stroke="#6B4A2B" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      ${BLUSH(34, 66, 62, 5.5)}`
  },

  seal: {
    ru: 'Тюлень',
    color: '#8FA6BE',
    svg: `
      <circle cx="50" cy="52" r="34" fill="#8FA6BE"/>
      <ellipse cx="50" cy="66" rx="20" ry="15" fill="#C3D4E4"/>
      ${EYE(38, 62, 44, 6.5)}
      <ellipse cx="50" cy="59" rx="6" ry="4.6" fill="#3A2350"/>
      <path d="M50 64v3M50 67c-3.4 3.6-8 1.4-8-1.4M50 67c3.4 3.6 8 1.4 8-1.4"
            stroke="#5C7590" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M32 64l-12-3M32 69l-12 2M68 64l12-3M68 69l12 2" stroke="#6E88A3" stroke-width="2" stroke-linecap="round"/>
      ${BLUSH(28, 72, 58, 6)}`
  },

  giraffe: {
    ru: 'Жираф',
    color: '#FFC93C',
    svg: `
      <path d="M32 20v-8" stroke="#C9922A" stroke-width="5" stroke-linecap="round"/>
      <path d="M68 20v-8" stroke="#C9922A" stroke-width="5" stroke-linecap="round"/>
      <circle cx="32" cy="11" r="5" fill="#8A5A34"/>
      <circle cx="68" cy="11" r="5" fill="#8A5A34"/>
      <ellipse cx="15" cy="44" rx="9" ry="6" fill="#E8B02A" transform="rotate(-20 15 44)"/>
      <ellipse cx="85" cy="44" rx="9" ry="6" fill="#E8B02A" transform="rotate(20 85 44)"/>
      <circle cx="50" cy="52" r="32" fill="#FFC93C"/>
      <circle cx="32" cy="38" r="6" fill="#D99B2A"/>
      <circle cx="70" cy="40" r="5" fill="#D99B2A"/>
      <circle cx="27" cy="58" r="4.5" fill="#D99B2A"/>
      ${EYE(39, 61, 44, 6)}
      <ellipse cx="50" cy="68" rx="15" ry="12" fill="#FFE9A8"/>
      <ellipse cx="44.5" cy="65" rx="2.8" ry="2.2" fill="#8A5A34"/>
      <ellipse cx="55.5" cy="65" rx="2.8" ry="2.2" fill="#8A5A34"/>
      <path d="M44 72c3.4 2.8 9 2.8 12 0" stroke="#8A5A34" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
  },

  poodle: {
    ru: 'Пудель',
    color: '#F0DEC6',
    svg: `
      <circle cx="50" cy="20" r="12" fill="#EBD7BC"/>
      <circle cx="20" cy="46" r="15" fill="#EBD7BC"/>
      <circle cx="80" cy="46" r="15" fill="#EBD7BC"/>
      <circle cx="18" cy="62" r="11" fill="#EBD7BC"/>
      <circle cx="82" cy="62" r="11" fill="#EBD7BC"/>
      <circle cx="50" cy="52" r="31" fill="#F7EBDA"/>
      ${EYE(39, 61, 47, 5.6)}
      <ellipse cx="50" cy="64" rx="13" ry="10" fill="#FFF8EE"/>
      <ellipse cx="50" cy="60" rx="6" ry="4.4" fill="#3A2350"/>
      ${SMILE(64, 3.4)}
      ${BLUSH(30, 70, 62, 5.5)}`
  },

  raccoon: {
    ru: 'Енот',
    color: '#9AA6B4',
    svg: `
      <path d="M20 16 38 32 18 40z" fill="#7D8A99"/>
      <path d="M80 16 62 32 82 40z" fill="#7D8A99"/>
      <circle cx="50" cy="52" r="33" fill="#9AA6B4"/>
      <path d="M50 30c9 0 16 3 20 6-2 3-3 6-3 9 0 4-7 8-17 8s-17-4-17-8c0-3-1-6-3-9 4-3 11-6 20-6Z" fill="#3C4655"/>
      <path d="M50 24c8 0 15 2 20 5-3 1-6 3-8 5-3-2-7-3-12-3s-9 1-12 3c-2-2-5-4-8-5 5-3 12-5 20-5Z" fill="#E6EBF1"/>
      <circle cx="37" cy="46" r="5.6" fill="#fff"/>
      <circle cx="63" cy="46" r="5.6" fill="#fff"/>
      <circle cx="38" cy="46" r="3" fill="#2A1A3E"/>
      <circle cx="64" cy="46" r="3" fill="#2A1A3E"/>
      <ellipse cx="50" cy="66" rx="13" ry="10" fill="#D6DEE7"/>
      <ellipse cx="50" cy="62" rx="5.6" ry="4.2" fill="#2A2E39"/>
      ${SMILE(66, 3.4)}`
  },

  parrot: {
    ru: 'Попугай',
    color: '#5FBF5F',
    svg: `
      <path d="M50 26c-2-10-9-13-12-10s0 9 5 12z" fill="#E63946"/>
      <path d="M50 25c0-11 5-15 8-13s2 9-2 13z" fill="#FFC93C"/>
      <path d="M50 26c3-10 10-12 12-9s-1 9-6 11z" fill="#FF8A3D"/>
      <circle cx="50" cy="54" r="31" fill="#5FBF5F"/>
      <path d="M50 23c11 0 20 7 24 16-7 3-15 5-24 5s-17-2-24-5c4-9 13-16 24-16Z" fill="#7CD67C"/>
      ${EYE(37, 63, 48, 6.5)}
      <path d="M50 58c6.5 0 11 3.4 11 8 0 6-5 11-11 11s-11-5-11-11c0-4.6 4.5-8 11-8Z" fill="#FFB03A"/>
      <path d="M50 61.5c4 0 7 2.2 7 5.6 0 4-3 7.4-7 7.4z" fill="#E8862A"/>
      <path d="M39.5 66.5h21" stroke="#C9711E" stroke-width="1.8" stroke-linecap="round"/>
      ${BLUSH(28, 72, 60, 6, '#FF5C8A')}
    `
  }
};

export const AVATAR_IDS = Object.keys(A);
export const AVATAR_LABELS = AVATAR_IDS.reduce((acc, k) => { acc[k] = A[k].ru; return acc; }, {});
export const AVATAR_COLORS = AVATAR_IDS.reduce((acc, k) => { acc[k] = A[k].color; return acc; }, {});

export function avatarSprite() {
  return '<svg class="avatar-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">' +
    AVATAR_IDS.map((n) => `<symbol id="v-${n}" viewBox="0 0 100 100">${A[n].svg}</symbol>`).join('') +
    '</svg>';
}

export function avatar(id, cls) {
  if (!A[id]) return '';
  return `<svg class="av-svg ${cls || ''}" aria-hidden="true"><use href="#v-${id}"/></svg>`;
}

export function hasAvatar(id) {
  return !!A[id];
}

export function mountAvatarSprite() {
  if (document.querySelector('.avatar-sprite')) return;
  document.body.insertAdjacentHTML('afterbegin', avatarSprite());
}
