import { esc, mediaHtml } from '../util.js';

// «Год за минуту» — не конкурс, а тёплый номер: фотографии по месяцам,
// пока накрывают на стол. Баллов тут нет и не надо.
//
// Каждый кадр — отдельный «вопрос»: так работают и «Дальше», и точки
// перехода на пульте, и ничего не нужно придумывать заново.

export default {
  id: 'slideshow',
  accent: '#D9497F',
  label: 'Год за минуту',
  icon: 'photo',
  order: 120,
  prop: { intro: 'mic', question: '', reveal: '' },
  itemNoun: 'кадр',

  itemFields: [
    { k: 'media', f: 'media', kind: 'photo', label: 'Фотография', required: 'нет фото' },
    { k: 'text', f: 'q', label: 'Подпись', placeholder: 'Например: «Три месяца — первая улыбка»' }
  ],

  scoring: { rule: 'manual' },
  participation: {},

  newContest() {
    return {
      title: 'Год за минуту',
      subtitle: 'Тёплый номер',
      rules: 'Смотрим, как рос наш артист.',
      pointsPerCorrect: 0
    };
  },

  newItem() {
    return { id: '', media: '', q: '' };
  },

  stage(ctx) {
    return `
      <div class="slide fade-in">
        ${mediaHtml(ctx.item.media, 'Фотография ещё не выбрана — добавь её в кабинете')}
        ${ctx.item.q ? `<div class="slide-caption">${esc(ctx.item.q)}</div>` : ''}
      </div>
      <div class="q-counter">${ctx.index + 1} из ${ctx.total}</div>
    `;
  },

  lion() {
    return 'Как быстро растут артисты…';
  },

  remote(ctx) {
    return `
      <div class="r-question">${esc(ctx.item.q || 'Без подписи')}</div>
      <div class="r-note">${ctx.item.media ? esc(ctx.item.media) : 'фото не выбрано'}</div>
      <div class="r-note">Листай «Дальше» — или включи музыку в быстрых действиях.</div>
    `;
  }
};
