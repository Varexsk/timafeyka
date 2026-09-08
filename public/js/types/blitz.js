import { counterHtml, esc, questionClass, correctText } from '../util.js';
import { icon } from '../icons.js';

// Блиц на время. Одна семья отвечает подряд, пока не кончится минута.
//
// Ведущему нужны ровно две кнопки во весь палец — «Верно» и «Мимо», —
// потому что смотреть он будет на зал, а не на экран телефона.

function playing(ctx) {
  const id = ctx.contestSlice.who;
  return ctx.owners.find((o) => o.id === id) || null;
}

function tally(ctx) {
  const s = ctx.contestSlice || {};
  return { right: Number(s.right) || 0, missed: Number(s.missed) || 0 };
}

// Следующий вопрос конкурса — блиц идёт без остановки на «Ответ».
function step(ctx, api, correct) {
  const who = playing(ctx);
  const t = tally(ctx);

  if (correct && who) api.send('award', { id: who.id, delta: ctx.points, reason: ctx.contest.title });
  api.send('setSlice', { scope: 'contest',
      patch: correct ? { right: t.right + 1 } : { missed: t.missed + 1 }
  });

  const next = ctx.items[ctx.index + 1];
  if (next) {
    api.send('goto', { contestId: ctx.contest.id, itemId: next.id, phase: 'question' });
  } else {
    api.send('reveal', { on: true });
    api.toast('Вопросы кончились!');
  }
}

export default {
  id: 'blitz',
  accent: '#E63946',
  label: 'Блиц на время',
  icon: 'clock',
  order: 100,
  prop: { intro: 'mic', question: '', reveal: 'star' },

  itemFields: [
    { k: 'textarea', f: 'q', label: 'Вопрос', rows: 2 },
    { k: 'text', f: 'answerText', label: 'Ответ — его увидит только ведущий на пульте',
      required: 'не заполнен ответ' }
  ],

  // Балл даёт ведущий кнопкой «Верно»: в блице некогда раскрывать ответы.
  scoring: { rule: 'manual' },
  participation: {},
  timer: { seconds: 60, autoStart: 'manual', onEnd: 'stop', label: 'Блиц!' },

  newContest() {
    return { title: 'Блиц', subtitle: 'Минута на всё', rules: 'Отвечаем быстро: сколько успеем за минуту.' };
  },

  newItem() {
    return { id: '', q: 'Новый вопрос', answerText: '' };
  },

  stage(ctx) {
    const who = playing(ctx);
    const t = tally(ctx);
    return `
      ${counterHtml(ctx)}
      ${who ? `<div class="eyebrow">На арене: ${esc(who.name)}</div>` : ''}
      <div class="${questionClass(ctx.item.q)}">${esc(ctx.item.q)}</div>
      <div class="blitz-score">
        <span class="is-right">${t.right}</span>
        <span class="muted">верно</span>
        <span class="is-missed">${t.missed}</span>
        <span class="muted">мимо</span>
      </div>
      ${ctx.phase === 'reveal' ? `<div class="answer-card pop-in">${esc(correctText(ctx.item))}</div>` : ''}
    `;
  },

  lion(ctx) {
    return ctx.phase === 'reveal' ? 'Вот это скорость!' : 'Быстрее, быстрее! Время не ждёт.';
  },

  remote(ctx) {
    const who = playing(ctx);
    const t = tally(ctx);
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-answer">
        <span class="r-answer-label">Ответ</span>
        <span class="r-answer-text">${esc(correctText(ctx.item) || 'не заполнен')}</span>
      </div>

      <div class="r-note">Кто отвечает: ${who ? `<b>${esc(who.name)}</b>` : 'не выбрали'} · верно ${t.right}, мимо ${t.missed}</div>
      <div class="r-media-controls">
        ${ctx.owners.map((o) => `
          <button class="btn ${who && who.id === o.id ? 'btn--primary' : 'btn--ghost'}"
                  data-act="who" data-owner="${esc(o.id)}">${esc(o.name)}</button>`).join('')}
      </div>

      <div class="blitz-keys">
        <button class="btn btn--primary" data-act="right">Верно +${ctx.points}</button>
        <button class="btn btn--ghost" data-act="miss">Мимо</button>
      </div>
      <button class="btn btn--ghost btn--wide" data-act="reset" style="margin-top:.4rem">
        ${icon('refresh')} Сбросить счёт блица
      </button>
    `;
  },

  actions: {
    who(ctx, api, btn) {
      api.send('setSlice', { scope: 'contest', patch: { who: btn.dataset.owner, right: 0, missed: 0 } });
    },
    right(ctx, api) { step(ctx, api, true); },
    miss(ctx, api) { step(ctx, api, false); },
    reset(ctx, api) {
      api.send('setSlice', { scope: 'contest', patch: { right: 0, missed: 0 } });
      api.toast('Счёт блица сброшен');
    }
  }
};
