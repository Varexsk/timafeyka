import { counterHtml, esc, questionClass, noteHtml } from '../util.js';
import { icon } from '../icons.js';

// Физический номер: пройти по канату из подушек, изобразить слона, донести
// шарик на ложке. Экран показывает задание и таймер, судит ведущий.
//
// Это то, чего на детских праздниках всегда не хватает: конкурс, ради
// которого встают из-за стола.

const JUDGE = [
  { v: 'pass', label: 'Зачёт или незачёт' },
  { v: 'stars', label: 'Звёзды от 1 до 5' }
];

function playing(ctx) {
  const id = ctx.contestSlice.who;
  return ctx.owners.find((o) => o.id === id) || null;
}

export default {
  id: 'physical',
  accent: '#2F9B4A',
  label: 'Номер на арене',
  icon: 'balance',
  order: 110,
  prop: { intro: 'mic', question: 'whistle', reveal: 'star' },
  itemNoun: 'задание',

  itemFields: [
    { k: 'textarea', f: 'q', label: 'Задание', rows: 2,
      placeholder: 'Например: «Пронеси шарик на ложке от дивана до окна»' },
    { k: 'row',
      of: [
        { k: 'number', f: 'seconds', label: 'Секунд на попытку', min: 5, max: 600,
          placeholder: '30' },
        { k: 'select', f: 'judge', label: 'Как судим', values: JUDGE }
      ] },
    { k: 'text', f: 'answerNote', label: 'Приписка (необязательно)' }
  ],

  // Судит ведущий: машина не разберёт, донёс ли шарик.
  scoring: { rule: 'manual' },
  participation: {},
  // Число берётся из поля вопроса; таймер ведущий запускает сам, когда все готовы.
  timer: { seconds: 'seconds', autoStart: 'manual', onEnd: 'stop', label: 'Время на попытку' },

  newContest() {
    return { title: 'Номер на арене', subtitle: 'Всех прошу на манеж' };
  },

  newItem() {
    return { id: '', q: 'Новое задание', seconds: 30, judge: 'pass', answerNote: '' };
  },

  stage(ctx) {
    const who = playing(ctx);
    return `
      ${counterHtml(ctx)}
      ${who ? `<div class="eyebrow">На арене: ${esc(who.name)}</div>` : ''}
      <div class="${questionClass(ctx.item.q)}">${esc(ctx.item.q)}</div>
      ${ctx.item.seconds ? `<div class="hint">На попытку — ${esc(ctx.item.seconds)} секунд</div>` : ''}
      ${ctx.phase === 'reveal' ? noteHtml(ctx.item) : ''}
    `;
  },

  lion(ctx) {
    return playing(ctx)
      ? 'Тише, тише! Артист сосредоточился.'
      : 'Кто смелый? Выходите на манеж!';
  },

  remote(ctx) {
    const who = playing(ctx);
    const stars = ctx.item.judge === 'stars';
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-note">Кто выступает: ${who ? `<b>${esc(who.name)}</b>` : 'выбери ниже'}</div>
      <div class="r-media-controls">
        ${ctx.owners.map((o) => `
          <button class="btn ${who && who.id === o.id ? 'btn--primary' : 'btn--ghost'}"
                  data-act="who" data-owner="${esc(o.id)}">${esc(o.name)}</button>`).join('')}
      </div>

      <div class="r-note" style="margin-top:.6rem">Судейство</div>
      <div class="r-media-controls">
        ${stars
    ? [1, 2, 3, 4, 5].map((n) => `
            <button class="btn btn--ghost" data-act="stars" data-n="${n}">${icon('star')} ${n}</button>`).join('')
    : `<button class="btn btn--primary" data-act="pass">${icon('check')} Справился +${ctx.points}</button>
           <button class="btn btn--ghost" data-act="fail">${icon('cross')} В другой раз</button>`}
      </div>
      <div class="r-media-controls">
        <button class="btn btn--ghost" data-act="start">${icon('clock')} Запустить ${Number(ctx.item.seconds) || 30} с</button>
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  },

  actions: {
    who(ctx, api, btn) {
      api.send('setSlice', { scope: 'contest', patch: { who: btn.dataset.owner } });
    },
    start(ctx, api) {
      api.send('timerStart', {
        seconds: Number(ctx.item.seconds) || 30,
        label: 'Время на попытку'
      });
      api.toast('Время пошло!');
    },
    pass(ctx, api) {
      const who = playing(ctx);
      if (!who) { api.toast('Сначала выбери, кто выступает'); return; }
      api.send('award', { id: who.id, delta: ctx.points, reason: ctx.contest.title });
      api.send('fx', { type: 'confetti' });
    },
    fail(ctx, api) {
      api.send('fx', { type: 'wrong' });
      api.toast('Ничего, впереди ещё номера');
    },
    stars(ctx, api, btn) {
      const who = playing(ctx);
      if (!who) { api.toast('Сначала выбери, кто выступает'); return; }
      const n = Number(btn.dataset.n) || 0;
      api.send('award', { id: who.id, delta: n, reason: ctx.contest.title });
      if (n >= 4) api.send('fx', { type: 'confetti' });
    }
  }
};
