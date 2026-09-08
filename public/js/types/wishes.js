import { esc } from '../util.js';
import { icon } from '../icons.js';

// «Пожелания имениннику». Гости пишут с телефонов, ведущий листает их на
// экране крупно, Лёва зачитывает.
//
// Это лучший ответ на вопрос «зачем вообще телефоны»: после праздника
// остаётся не таблица баллов, а страница с тем, что написали близкие.
// Пожелания лежат в состоянии показа, поэтому уезжают в «Бэкап» вместе
// со всей программой.

function wishes(ctx) {
  const votes = (ctx.round && ctx.round.votes) || {};
  return ctx.owners
    .filter((o) => votes[o.id] !== undefined && String(votes[o.id].v).trim())
    .map((o) => ({ owner: o, text: String(votes[o.id].v), at: votes[o.id].at }))
    .sort((a, b) => a.at - b.at);
}

function shown(ctx, list) {
  const at = Number(ctx.slice.at) || 0;
  if (!list.length) return null;
  return list[Math.min(at, list.length - 1)];
}

export default {
  id: 'wishes',
  accent: '#D9A00F',
  label: 'Пожелания имениннику',
  icon: 'quote',
  order: 130,
  prop: { intro: 'mic', question: 'ticket', reveal: 'ticket' },
  itemNoun: 'сбор',

  itemFields: [
    { k: 'textarea', f: 'q', label: 'О чём просим написать', rows: 2,
      placeholder: 'Что пожелаешь Тимоше?' }
  ],

  scoring: { rule: 'manual' },
  participation: {
    vote: { kind: 'text', placeholder: 'Напиши пожелание — его прочитают на весь зал' }
  },

  newContest() {
    return {
      title: 'Пожелания имениннику',
      subtitle: 'Номер на память',
      rules: 'Возьмите телефоны и напишите пару слов — мы их прочитаем.',
      playMode: 'phones',
      pointsPerCorrect: 0
    };
  },

  newItem() {
    return { id: '', q: 'Что пожелаешь имениннику?' };
  },

  stage(ctx) {
    const list = wishes(ctx);
    const one = shown(ctx, list);

    if (!list.length) {
      return `
        <div class="question question--sm">${esc(ctx.item.q || 'Что пожелаешь имениннику?')}</div>
        <div class="hint">Берите телефоны — пожелания появятся здесь</div>`;
    }

    return `
      <div class="q-counter">Пожелание ${Math.min(Number(ctx.slice.at) || 0, list.length - 1) + 1} из ${list.length}</div>
      <div class="wish pop-in">
        <div class="wish-text">${esc(one.text)}</div>
        <div class="wish-from">${esc(one.owner.name)}</div>
      </div>
    `;
  },

  lion(ctx) {
    return wishes(ctx).length
      ? 'Какие тёплые слова! Запомним их все.'
      : 'Пишите, пишите — я потом всё зачитаю.';
  },

  remote(ctx) {
    const list = wishes(ctx);
    const at = Math.min(Number(ctx.slice.at) || 0, Math.max(0, list.length - 1));
    return `
      <div class="r-question">${esc(ctx.item.q || 'Что пожелаешь имениннику?')}</div>
      <div class="r-note">Прислали: <b>${list.length}</b> из ${ctx.owners.length}</div>
      ${list.length ? `
        <div class="r-answer">
          <span class="r-answer-label">${esc(list[at].owner.name)}</span>
          <span class="r-answer-text">${esc(list[at].text)}</span>
        </div>
        <div class="r-media-controls">
          <button class="btn btn--ghost" data-act="prev">${icon('arrow-left')} Раньше</button>
          <button class="btn btn--primary" data-act="next">Дальше ${icon('arrow-right')}</button>
        </div>` : '<div class="r-note">Пока пусто. Напомни гостям про QR-код на экране.</div>'}
    `;
  },

  actions: {
    prev(ctx, api) {
      const at = Number(ctx.slice.at) || 0;
      api.send('setSlice', { patch: { at: Math.max(0, at - 1) } });
    },
    next(ctx, api) {
      const at = Number(ctx.slice.at) || 0;
      api.send('setSlice', { patch: { at: at + 1 } });
    }
  }
};
