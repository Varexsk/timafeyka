// Заставка: название цирка, возраст именинника и QR-код пульта.

import { esc, names } from '../util.js';
import { qrSvg } from '../lib/qr.js';

export function welcome(state, net) {
  const n = names(state);
  const url = net && net.url ? net.url : '';
  return `
    <div class="eyebrow fade-in">Дамы и господа, добро пожаловать</div>
    <h1 class="title-xl gold-text fade-in">${esc(n.title)}</h1>
    <div class="welcome-age">${esc(n.age)}</div>
    <div class="title-m fade-in purple-text">${esc(n.hero)} празднует первый день рождения!</div>
    ${url ? `
      <div class="connect-card fade-in">
        ${qrSvg(url, { dark: '#3A2350', light: '#ffffff' })}
        <div>
          <div class="label">Пульт ведущего</div>
          <div class="url">${esc(url)}</div>
        </div>
      </div>` : ''}
    <div class="hint">Начинаем — «дальше» на пульте или пробел на клавиатуре</div>
  `;
}
