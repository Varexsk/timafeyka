import { optionsHtml, noteHtml, counterHtml, questionClass, esc } from '../util.js';

const OPTIONS = [
  { text: 'Правда', icon: 'yes' },
  { text: 'Ложь', icon: 'no' }
];

export default {
  id: 'trueFalse',
  accent: '#2E6DAF',
  label: 'Правда или ложь',
  icon: 'balance',
  order: 60,
  prop: { intro: 'mic', question: '', reveal: 'star' },
  editor: { options: false, trueFalse: true },

  newItem() {
    return { id: '', q: 'Новое утверждение', answer: null, answerNote: '' };
  },

  stage(ctx) {
    const { item, phase } = ctx;
    const revealed = phase === 'reveal';
    return `
      ${counterHtml(ctx)}
      <div class="${questionClass(item.q)}">${esc(item.q)}</div>
      ${optionsHtml(OPTIONS, item.answer, revealed)}
      ${revealed && !Number.isInteger(item.answer)
        ? '<div class="answer-empty">Правда это или ложь — отметь в кабинете</div>' : ''}
      ${revealed ? noteHtml(item) : ''}
    `;
  },

  lion(ctx) {
    return ctx.phase === 'reveal'
      ? 'Вот вам и правда, дамы и господа!'
      : 'Верите или нет? Решайте, я подожду.';
  },

  remote(ctx) {
    const a = ctx.item.answer;
    const text = a === 0 ? 'Правда' : a === 1 ? 'Ложь' : '';
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-answer ${text ? '' : 'is-empty'}">
        <span class="r-answer-label">Это</span>
        <span class="r-answer-text">${text || 'не заполнено'}</span>
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  },

  OPTIONS
};
