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

  scoring: { rule: 'exact', field: 'answer' },
  participation: { vote: { kind: 'choice', from: 'options' } },

  newItem() {
    return { id: '', q: 'Новый вопрос', options: [], answer: null, answerText: '', answerNote: '', media: '' };
  },

  stage(ctx) {
    const { item, phase } = ctx;
    const revealed = phase === 'reveal';
    const opts = item.options || [];

    // Экран делится на три столбца: слева фотография, посередине вопрос со
    // своими вариантами, справа — табло со счётом. Снимку достаётся вся высота
    // сцены (снимки с телефона почти все вертикальные), а вопрос стоит над
    // своими вариантами, а не через полэкрана от них.
    if (item.media && opts.length) {
      return `
        ${counterHtml(ctx)}
        <div class="split">
          <div class="split-media">${mediaHtml(item.media)}</div>
          <div class="split-side">
            <div class="${questionClass(item.q)}">${esc(item.q)}</div>
            ${optionsHtml(opts, item.answer, revealed)}
          </div>
        </div>
        ${revealed ? answerHtml(item, opts) : ''}
        ${revealed ? noteHtml(item) : ''}
      `;
    }

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
