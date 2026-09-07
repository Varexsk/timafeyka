import { optionsHtml, answerHtml, noteHtml, counterHtml, esc, LETTERS } from '../util.js';

function correctText(item) {
  const opts = item.options || [];
  if (Number.isInteger(item.answer) && opts[item.answer]) {
    const o = opts[item.answer];
    return `${LETTERS[item.answer] || ''} — ${typeof o === 'string' ? o : o.text}`;
  }
  return (item.answerText || '').trim();
}

export default {
  id: 'quotes',
  accent: '#6F42D4',
  label: 'Кто это сказал',
  icon: 'quote',
  editor: { options: true, openAnswer: true, guestOptions: true },

  newItem() {
    return { id: '', q: 'Новая цитата', options: [], answer: null, answerText: '', answerNote: '' };
  },

  stage(ctx) {
    const { item, phase } = ctx;
    const revealed = phase === 'reveal';
    const opts = item.options || [];
    return `
      ${counterHtml(ctx)}
      <div class="quote pop-in">
        <span class="quote-mark quote-mark--l">«</span>
        <div class="quote-text">${esc(item.q)}</div>
        <span class="quote-mark quote-mark--r">»</span>
      </div>
      ${optionsHtml(opts, item.answer, revealed)}
      ${revealed ? answerHtml(item, opts) : ''}
      ${revealed ? noteHtml(item) : ''}
    `;
  },

  lion(ctx) {
    return ctx.phase === 'reveal'
      ? 'Ну конечно! Я сразу узнал этот голос.'
      : 'Кто-то из вас это сказал. Признавайтесь!';
  },

  remote(ctx) {
    const answer = correctText(ctx.item);
    return `
      <div class="r-question">«${esc(ctx.item.q)}»</div>
      <div class="r-answer ${answer ? '' : 'is-empty'}">
        <span class="r-answer-label">Это сказал</span>
        <span class="r-answer-text">${answer ? esc(answer) : 'не заполнено'}</span>
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  },

  correctText
};
