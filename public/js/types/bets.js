import { counterHtml, noteHtml, esc, ownerAvatar, fmtNum } from '../util.js';
import { icon } from '../icons.js';

// Ближайшая ставка к правильному числу. Если промахнулись одинаково —
// балл получают все, кто попал одинаково близко.
function winners(ctx) {
  const target = Number(ctx.item.value);
  if (!isFinite(target) || ctx.item.value === null || ctx.item.value === '') return [];
  let best = Infinity;
  let out = [];
  for (const o of ctx.owners) {
    const bet = ctx.voteOf(o.id);
    if (bet === null) continue;
    const num = Number(bet);
    if (!isFinite(num)) continue;
    const diff = Math.abs(num - target);
    if (diff < best - 1e-9) { best = diff; out = [o.id]; }
    else if (Math.abs(diff - best) < 1e-9) out.push(o.id);
  }
  return out;
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

  // Балл забирает ближайший — движок начисляет его сам, когда раскрыли ответ.
  // Раньше для этого была отдельная кнопка «Балл ближайшему» на пульте.
  scoring: { rule: 'nearest', field: 'value', tie: 'all' },
  participation: {
    vote: { kind: 'number', unitField: 'unit', label: 'Впиши, кто какое число назвал:' }
  },

  newContest() {
    return { title: 'Кто ближе к правде' };
  },

  newItem() {
    return { id: '', q: 'Сколько?', value: null, unit: '', answerNote: '' };
  },

  stage(ctx) {
    const { item, phase } = ctx;
    const revealed = phase === 'reveal';
    const win = revealed ? winners(ctx) : [];
    const unit = (item.unit || '').trim();
    const hasValue = item.value !== null && item.value !== undefined && item.value !== '';

    return `
      ${counterHtml(ctx)}
      <div class="question question--sm">${esc(item.q)}</div>
      <div class="bets">
        ${ctx.owners.map((o) => {
    const bet = ctx.voteOf(o.id);
    const has = bet !== null;
    const diff = revealed && has && hasValue ? Math.abs(Number(bet) - Number(item.value)) : null;
    return `<div class="bet-card ${win.includes(o.id) ? 'is-win' : revealed ? 'is-dim' : ''}" style="--c:${esc(o.color || 'var(--ink)')}">
            ${ownerAvatar(o, 'bet-av')}
            <div class="bet-name">${esc(o.name)}</div>
            <div class="bet-value">${has ? esc(fmtNum(bet)) : '…'}</div>
            ${diff !== null ? `<div class="bet-diff">${diff === 0 ? 'точно!' : 'мимо на ' + fmtNum(Math.round(diff * 10) / 10)}</div>` : ''}
            ${win.includes(o.id) ? `<span class="bet-crown">${icon('crown-fill')}</span>` : ''}
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
    // Поля для ввода ставок рисует движок — по объявленному выше participation.
    // Формату остаётся подсказать ведущему правильное число.
    const unit = (ctx.item.unit || '').trim();
    const hasValue = ctx.item.value !== null && ctx.item.value !== undefined && ctx.item.value !== '';
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-answer ${hasValue ? '' : 'is-empty'}">
        <span class="r-answer-label">Правильное число</span>
        <span class="r-answer-text">${hasValue ? esc(fmtNum(ctx.item.value)) + (unit ? ' ' + esc(unit) : '') : 'не заполнено'}</span>
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  }
};
