import { counterHtml, noteHtml, esc } from '../util.js';
import { icon } from '../icons.js';

export default {
  id: 'challenge',
  accent: '#D9631B',
  label: 'Фанты и задания',
  icon: 'hat',
  order: 80,
  prop: { intro: 'mic', question: 'whistle', reveal: 'whistle' },
  editor: { options: false, noAnswer: true },

  newItem() {
    return { id: '', q: 'Новое задание', answerNote: '' };
  },

  stage(ctx) {
    const { item, phase } = ctx;
    return `
      ${counterHtml(ctx)}
      <div class="ticket pop-in">
        <div class="ticket-label">${esc((ctx.names && ctx.names.lion) || 'Лёва')} объявляет задание</div>
        <div class="ticket-text">${esc(item.q)}</div>
      </div>
      ${phase === 'reveal'
        ? `<div class="answer-note fade-in">Справился? Ведущий начисляет балл ${icon('star-fill')}</div>${noteHtml(item)}`
        : '<div class="hint">Ведущий выбирает смельчака</div>'}
    `;
  },

  lion(ctx) {
    return ctx.phase === 'reveal'
      ? 'Браво! Вот это номер, я такого даже в Париже не видел!'
      : 'Смелее! Арена ждёт своего героя.';
  },

  remote(ctx) {
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-note">Начисли балл тому, кто справился.</div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  }
};
