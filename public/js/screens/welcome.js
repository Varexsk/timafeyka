// Заставка: название цирка, возраст именинника и QR-код пульта.

import { esc, names } from '../util.js';
import { qrSvg } from '../lib/qr.js';

// В режиме «телефоны» на заставке крупный QR для гостей: навёл камеру —
// и играешь. Ссылка на пульт ведущему нужна один раз, она уходит вниз мелко.
export function welcome(state, net) {
  const n = names(state);
  const phones = ((state.show && state.show.playMode) === 'phones');
  const play = (net && net.playUrl) || '';
  const remote = (net && net.remoteUrl) || '';

  // Гостевой QR наводят с другого конца комнаты — он крупный. Пульт ведущему
  // нужен один раз, его карточка остаётся скромной.
  const card = (url, label, hint, big) => `
    <div class="connect-card${big ? ' connect-card--play' : ''} fade-in">
      ${qrSvg(url, { dark: '#3A2350', light: '#ffffff' })}
      <div>
        <div class="label">${esc(label)}</div>
        <div class="url">${esc(url)}</div>
        ${hint ? `<div class="hint" style="margin:.3rem 0 0">${esc(hint)}</div>` : ''}
      </div>
    </div>`;

  return `
    <div class="eyebrow fade-in">Дамы и господа, добро пожаловать</div>
    <h1 class="title-xl gold-text fade-in">${esc(n.title)}</h1>
    <div class="welcome-center">
      <img class="circus-illustration art-drum" src="/img/circus-drum.svg" alt="" width="240" height="200">
      <div class="birthday-seal"><div class="welcome-age">${esc(n.age)}</div><span>Главная звезда цирка</span></div>
      <img class="circus-illustration art-magic" src="/img/magic-hat.svg" alt="" width="240" height="200">
    </div>
    <div class="title-m fade-in purple-text">${esc(n.hero)} празднует первый день рождения!</div>
    ${phones && play
    ? card(play, 'Наведи камеру — будешь играть', 'Гости отвечают со своих телефонов', true)
    : (remote ? card(remote, 'Пульт ведущего', '') : '')}
    ${phones && play && remote ? `<div class="hint">Пульт ведущего: ${esc(remote)}</div>` : ''}
    <div class="hint">Начинаем — «дальше» на пульте или пробел на клавиатуре</div>
  `;
}
