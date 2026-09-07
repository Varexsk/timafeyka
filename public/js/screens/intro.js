// Афиша номера: цветная иконка формата, название и правила.

import { esc } from '../util.js';
import { icon } from '../icons.js';
import { getType } from '../engine/registry.js';

export function intro(contest) {
  const type = getType(contest.type);
  return `
    <div class="poster pop-in">
      ${icon(type.icon, 'poster-ic')}
      <div class="eyebrow">${esc(contest.subtitle || 'Следующий номер')}</div>
      <h2 class="title-l gold-text">${esc(contest.title)}</h2>
      ${contest.rules ? `<div class="rules">${esc(contest.rules)}</div>` : ''}
    </div>
    <div class="hint">Готовы? Поехали!</div>
  `;
}
