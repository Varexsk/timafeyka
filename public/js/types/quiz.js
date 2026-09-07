import { optionsHtml, mediaHtml, answerHtml, noteHtml, counterHtml, questionClass, esc, LETTERS } from '../util.js';

function correctText(item) {
  const opts = item.options || [];
  if (Number.isInteger(item.answer) && opts[item.answer]) {
    const o = opts[item.answer];
    const text = typeof o === 'string' ? o : o.text;
    return `${LETTERS[item.answer] || ''} — ${text}`;
  }
  return (item.answerText || '').trim();
}

export default {
  id: 'quiz',
  accent: '#D9A00F',
  label: 'Викторина',
  icon: 'question',
  editor: { options: true, media: 'photo', openAnswer: true },

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
  },

  correctText
};
