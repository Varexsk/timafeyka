// Таблица лидеров: столбики звёздочек от большего к меньшему.

import { esc, owners } from '../util.js';
import { avatarHtml, sorted } from './parts.js';

const BAR_COLORS = ['var(--red)', 'var(--teal)', 'var(--purple)', 'var(--orange)', 'var(--blue)', 'var(--green)'];

export function leaderboard(state) {
  const list = sorted(owners(state));
  const max = Math.max(1, ...list.map((g) => g.score || 0));
  return `
    <div class="eyebrow fade-in">Считаем звёздочки</div>
    <h2 class="title-l gold-text fade-in">Таблица лидеров</h2>
    <div class="board fade-in">
      ${list.map((g, i) => `
        <div class="board-row ${i === 0 && g.score ? 'is-first' : ''}">
          <div class="rank">${i + 1}</div>
          ${avatarHtml(g)}
          <div class="name">${esc(g.name)}</div>
          <div class="bar" style="--c:${BAR_COLORS[i % BAR_COLORS.length]}">
            <span style="width:${Math.round(((g.score || 0) / max) * 100)}%"></span>
          </div>
          <div class="pts">${g.score || 0}</div>
        </div>`).join('')}
    </div>
  `;
}
