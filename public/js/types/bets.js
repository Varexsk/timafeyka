import { counterHtml, noteHtml, esc, owners, ownerAvatar, fmtNum } from '../util.js';
import { icon } from '../icons.js';

export function betKey(contest, item) {
  return contest.id + '/' + item.id;
}

function betsOf(ctx) {
  const all = (ctx.state.runtime && ctx.state.runtime.bets) || {};
  return all[betKey(ctx.contest, ctx.item)] || {};
}

// Ближайшая ставка к правильному числу. При равенстве побеждает тот, кто выше в списке.
export function winnerId(ctx) {
  const value = Number(ctx.item.value);
  if (!isFinite(value) || ctx.item.value === null) return null;
  const bets = betsOf(ctx);
  let best = null;
  for (const o of owners(ctx.state)) {
    const bet = bets[o.id];
    if (bet === undefined) continue;
    const diff = Math.abs(Number(bet) - value);
    if (!best || diff < best.diff) best = { id: o.id, diff };
  }
  return best ? best.id : null;
}

export default {
  id: 'bets',
  accent: '#2F9B4A',
  label: 'Ставки на число',
  icon: 'target',
  order: 20,
  prop: { intro: 'mic', question: '', reveal: 'star' },
  itemFields: [
    { k: 'textarea', f: 'q', label: 'Вопрос', rows: 2 },
    { k: 'row',
      of: [
        { k: 'number', f: 'value', label: 'Правильное число', step: 'any',
          placeholder: 'например 3250', required: 'не заполнено правильное число' },
        { k: 'text', f: 'unit', label: 'Единицы', width: '8rem', placeholder: 'г, см, шт' }
      ] },
    { k: 'text', f: 'answerNote', label: 'Приписка к ответу (необязательно)',
      placeholder: 'Например: «Ровно в обед!»' }
  ],

  newItem() {
    return { id: '', q: 'Сколько?', value: null, unit: '', answerNote: '' };
  },

  stage(ctx) {
    const { item, phase } = ctx;
    const revealed = phase === 'reveal';
    const bets = betsOf(ctx);
    const win = revealed ? winnerId(ctx) : null;
    const unit = (item.unit || '').trim();
    const hasValue = item.value !== null && item.value !== undefined && item.value !== '';

    return `
      ${counterHtml(ctx)}
      <div class="question question--sm">${esc(item.q)}</div>
      <div class="bets">
        ${owners(ctx.state).map((o) => {
    const bet = bets[o.id];
    const has = bet !== undefined;
    const diff = revealed && has && hasValue ? Math.abs(Number(bet) - Number(item.value)) : null;
    return `<div class="bet-card ${o.id === win ? 'is-win' : revealed ? 'is-dim' : ''}" style="--c:${esc(o.color || 'var(--ink)')}">
            ${ownerAvatar(o, 'bet-av')}
            <div class="bet-name">${esc(o.name)}</div>
            <div class="bet-value">${has ? esc(fmtNum(bet)) : '…'}</div>
            ${diff !== null ? `<div class="bet-diff">${diff === 0 ? 'точно!' : 'мимо на ' + fmtNum(Math.round(diff * 10) / 10)}</div>` : ''}
            ${o.id === win ? `<span class="bet-crown">${icon('crown-fill')}</span>` : ''}
          </div>`;
  }).join('')}
      </div>
      ${revealed
    ? (hasValue
      ? `<div class="answer-card pop-in">${esc(fmtNum(item.value))}${unit ? ' ' + esc(unit) : ''}</div>`
      : '<div class="answer-empty">Правильное число пока не заполнено — впиши его в кабинете</div>')
    : '<div class="hint">Ведущий записывает ставки на пульте</div>'}
      ${revealed ? noteHtml(item) : ''}
    `;
  },

  lion(ctx) {
    return ctx.phase === 'reveal'
      ? 'Вот это глазомер! Аплодисменты победителю.'
      : 'Делайте ваши ставки — числом, а не словом!';
  },

  remote(ctx) {
    const bets = betsOf(ctx);
    const unit = (ctx.item.unit || '').trim();
    const hasValue = ctx.item.value !== null && ctx.item.value !== undefined && ctx.item.value !== '';
    const win = winnerId(ctx);
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-answer ${hasValue ? '' : 'is-empty'}">
        <span class="r-answer-label">Правильное число</span>
        <span class="r-answer-text">${hasValue ? esc(fmtNum(ctx.item.value)) + (unit ? ' ' + esc(unit) : '') : 'не заполнено'}</span>
      </div>
      <div class="r-note">Впиши, кто сколько назвал:</div>
      ${owners(ctx.state).map((o) => `
        <div class="bet-row">
          ${ownerAvatar(o, 'bet-av-sm')}
          <span class="nm">${esc(o.name)}</span>
          <input type="number" inputmode="numeric" class="bet-in" data-bet="${esc(o.id)}"
                 value="${bets[o.id] === undefined ? '' : esc(bets[o.id])}" placeholder="${esc(unit || 'число')}">
        </div>`).join('')}
      <div class="r-media-controls">
        <button class="btn btn--ghost" data-bets="clear">${icon('refresh')} Стереть ставки</button>
        ${win ? `<button class="btn btn--primary" data-award-win="${esc(win)}">${icon('star-fill')} Балл ближайшему</button>` : ''}
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  }
};
