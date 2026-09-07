// Финал: подиум на три места, конфетти и туш прилетают из app.js.

import { esc, owners } from '../util.js';
import { icon } from '../icons.js';
import { avatarHtml, sorted } from './parts.js';

export function finale(state) {
  const list = sorted(owners(state)).filter((g) => (g.score || 0) > 0);
  const [first, second, third] = list;
  if (!first) {
    return `
      <h2 class="title-l gold-text fade-in">Спасибо за представление!</h2>
      <div class="hint">Баллов пока нет — но праздник всё равно удался</div>`;
  }
  const col = (g, place, cls) => (g ? `
    <div class="podium-col ${cls}">
      ${place === 1 ? icon('crown-fill', 'crown') : ''}
      ${avatarHtml(g)}
      <div class="name">${esc(g.name)}</div>
      <div class="pts">${g.score} ${icon('star-fill')}</div>
      <div class="podium-block">${place}</div>
    </div>` : '');
  return `
    <div class="eyebrow fade-in">Гран-при циркового вечера</div>
    <h2 class="title-l gold-text pop-in">${esc(first.name)}!</h2>
    <div class="podium">
      ${col(second, 2, 'podium-2')}
      ${col(first, 1, 'podium-1')}
      ${col(third, 3, 'podium-3')}
    </div>
    <div class="title-m purple-text fade-in">Победитель получает подарок ${icon('gift')}</div>
  `;
}
