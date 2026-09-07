import { optionsHtml, mediaHtml, answerHtml, noteHtml, counterHtml, questionClass, esc, correctText } from '../util.js';
import { needAnswer, noOptions } from '../engine/fields.js';

export default {
  id: 'quiz',
  accent: '#D9A00F',
  label: 'Викторина',
  icon: 'question',
  order: 10,
  prop: { intro: 'mic', question: '', reveal: 'star' },
  itemFields: [
    { k: 'textarea', f: 'q', label: 'Вопрос', rows: 2 },
    { k: 'options', f: 'options', check: needAnswer },
    { k: 'text', f: 'answerText', when: noOptions,
      label: 'Правильный ответ — покажется крупно на экране', placeholder: 'Например: «Мама»' },
    { k: 'media', f: 'media', kind: 'photo', label: 'Фото' },
    { k: 'text', f: 'answerNote', label: 'Приписка к ответу (необязательно)',
      placeholder: 'Например: «Ровно в обед!»' }
  ],

  newItem() {
    return { id: '', q: 'Новый вопрос', options: [], answer: null, answerText: '', answerNote: '', media: '' };
  },

  stage(ctx) {
    const { item, phase } = ctx;
    const revealed = phase === 'reveal';
    const opts = item.options || [];
    return `
      ${counterHtml(ctx)}
      <div class="${questionClass(item.q)}">${esc(item.q)}</div>
      ${item.media ? mediaHtml(item.media) : ''}
      ${optionsHtml(opts, item.answer, revealed)}
      ${revealed ? answerHtml(item, opts) : ''}
      ${revealed ? noteHtml(item) : ''}
    `;
  },

  remote(ctx) {
    const answer = correctText(ctx.item);
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-answer ${answer ? '' : 'is-empty'}">
        <span class="r-answer-label">Правильный ответ</span>
        <span class="r-answer-text">${answer ? esc(answer) : 'не заполнен'}</span>
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  }
};
