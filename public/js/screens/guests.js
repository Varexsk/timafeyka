// Знакомство с залом: семьями или каждым гостем отдельно.

import { esc, isTeamMode, fmtScore } from '../util.js';
import { rosterPage, pagerHtml } from '../roster.js';
import { icon } from '../icons.js';
import { avatarHtml } from './parts.js';

export function guests(state) {
  const list = state.guests || [];
  if (!list.length) {
    return `
      <h2 class="title-l gold-text fade-in">Наша труппа</h2>
      <div class="hint">Гостей пока нет — добавь их в кабинете или с пульта</div>`;
  }

  // В командном режиме знакомимся семьями, иначе — каждым гостем отдельно.
  if (isTeamMode(state)) {
    const teams = state.teams || [];
    const rest = list.filter((g) => !teams.some((t) => t.id === g.teamId));
    return `
      <div class="eyebrow fade-in">Сегодня на арене</div>
      <h2 class="title-l gold-text fade-in">Наши семьи</h2>
      <div class="family-grid fade-in">
        ${rosterPage(state, teams).list.map((t) => {
    const members = list.filter((g) => g.teamId === t.id);
    // На арену выходят не все: в большой семье играют двое, остальные болеют.
    const playing = members.filter((g) => g.playing !== false);
    const fans = members.filter((g) => g.playing === false);
    return `<div class="family-card" style="--c:${esc(t.color || 'var(--ink)')}">
            ${avatarHtml(t)}
            <div class="fname">${esc(t.name)}</div>
            <div class="members">${playing.length
      ? playing.map((g) => esc(g.name)).join(', ')
      : 'пока никого'}</div>
            ${fans.length ? `<div class="fans">болеют: ${fans.map((g) => esc(g.name)).join(', ')}</div>` : ''}
          </div>`;
  }).join('')}
      </div>
      ${pagerHtml(state, teams)}
      ${rest.length ? `<div class="hint">Пока без семьи: ${rest.map((g) => esc(g.name)).join(', ')}</div>` : ''}
    `;
  }

  return `
    <div class="eyebrow fade-in">Сегодня на арене</div>
    <h2 class="title-l gold-text fade-in">Наша труппа</h2>
    <div class="guest-grid fade-in">
      ${rosterPage(state, list).list.map((g) => `
        <div class="guest-card">
          ${avatarHtml(g)}
          <div class="name">${esc(g.name)}</div>
          <div class="score">${fmtScore(g.score)} ${icon('star-fill')}</div>
        </div>`).join('')}
    </div>
    ${pagerHtml(state, list)}
  `;
}
