import { counterHtml, esc, ownerAvatar, noteHtml, fmtNum } from '../util.js';
import { icon } from '../icons.js';

// Аукцион на баллы. Семьи ставят вслепую, победитель платит свою ставку
// и забирает приз.
//
// Хорошо ставить ближе к концу: у отстающих появляется способ рискнуть,
// а у лидеров — повод занервничать.

function bids(ctx) {
  return ctx.owners.map((o) => ({ owner: o, bid: ctx.voteOf(o.id), placed: ctx.hasVote(o.id) }));
}

function winner(ctx) {
  let best = 0;
  let out = null;
  for (const b of bids(ctx)) {
    const value = Number(b.bid);
    if (!isFinite(value) || value <= 0) continue;
    if (value > best) { best = value; out = b; }
  }
  return out;
}

export default {
  id: 'auction',
  accent: '#D9631B',
  label: 'Аукцион на баллы',
  icon: 'medal',
  order: 140,
  prop: { intro: 'mic', question: 'ticket', reveal: 'star' },
  itemNoun: 'лот',

  itemFields: [
    { k: 'textarea', f: 'q', label: 'Что разыгрываем', rows: 2,
      placeholder: 'Например: «Право первым задуть свечку»' },
    { k: 'row',
      of: [
        { k: 'number', f: 'prize', label: 'Приз в баллах', min: 1, max: 50,
          placeholder: '5', required: 'не указан приз' },
        { k: 'media', f: 'media', kind: 'photo', label: 'Фото лота (необязательно)' }
      ] },
    { k: 'text', f: 'answerNote', label: 'Приписка (необязательно)' }
  ],

  // Победитель платит ставку и забирает приз — считает это сервер.
  scoring: { rule: 'highestBid', prizeField: 'prize' },
  participation: {
    vote: { kind: 'number', label: 'Впиши ставки семей:' }
  },

  newContest() {
    return {
      title: 'Аукцион',
      subtitle: 'Кто рискнёт',
      rules: 'Ставьте баллы вслепую. Победитель платит свою ставку — и забирает приз.'
    };
  },

  newItem() {
    return { id: '', q: 'Новый лот', prize: 5, media: '', answerNote: '' };
  },

  stage(ctx) {
    const revealed = ctx.phase === 'reveal';
    const win = revealed ? winner(ctx) : null;
    const prize = Number(ctx.item.prize) || 0;

    return `
      ${counterHtml(ctx)}
      <div class="question question--sm">${esc(ctx.item.q)}</div>
      <div class="hint">Приз — ${prize} ${prize === 1 ? 'балл' : 'баллов'}</div>
      <div class="bets">
        ${bids(ctx).map((b) => `
          <div class="bet-card ${win && win.owner.id === b.owner.id ? 'is-win' : revealed ? 'is-dim' : ''}"
               style="--c:${esc(b.owner.color || 'var(--ink)')}">
            ${ownerAvatar(b.owner, 'bet-av')}
            <div class="bet-name">${esc(b.owner.name)}</div>
            <div class="bet-value">${revealed
    ? (b.placed ? esc(fmtNum(b.bid)) : '—')
    : (b.placed ? '???' : '…')}</div>
            ${win && win.owner.id === b.owner.id
    ? `<span class="bet-crown">${icon('crown-fill')}</span>` : ''}
          </div>`).join('')}
      </div>
      ${revealed
    ? (win
      ? `<div class="answer-card pop-in">${esc(win.owner.name)}: ${prize} − ${fmtNum(win.bid)} = ${prize - Number(win.bid)}</div>`
      : '<div class="answer-empty">Никто не поставил — лот остаётся у цирка</div>')
    : '<div class="hint">Ставки скрыты до объявления</div>'}
      ${revealed ? noteHtml(ctx.item) : ''}
    `;
  },

  lion(ctx) {
    return ctx.phase === 'reveal'
      ? 'Продано! Кто не рискнул, тот смотрит.'
      : 'Ставки, господа! Только тише — соседи подслушивают.';
  },

  remote(ctx) {
    const prize = Number(ctx.item.prize) || 0;
    const win = winner(ctx);
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-answer">
        <span class="r-answer-label">Приз</span>
        <span class="r-answer-text">${prize} ${prize === 1 ? 'балл' : 'баллов'}</span>
      </div>
      ${win ? `<div class="r-note">Сейчас впереди: <b>${esc(win.owner.name)}</b> со ставкой ${fmtNum(win.bid)}</div>` : ''}
      <div class="r-note">Ставку нельзя поставить больше, чем есть баллов — следи за этим сам.</div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  }
};
