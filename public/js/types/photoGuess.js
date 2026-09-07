import { optionsHtml, mediaHtml, answerHtml, noteHtml, counterHtml, esc, correctText } from '../util.js';

export default {
  id: 'photoGuess',
  accent: '#D9497F',
  label: 'Угадай по фото',
  icon: 'photo',
  order: 40,
  prop: { intro: 'mic', question: '', reveal: 'star' },
  editor: { options: true, media: 'photo', openAnswer: true, guestOptions: true },

  newItem() {
    return { id: '', q: 'Кто это?', media: '', options: [], answer: null, answerText: '', answerNote: '' };
  },

  stage(ctx) {
    const { item, phase } = ctx;
    const revealed = phase === 'reveal';
    const opts = item.options || [];
    return `
      ${counterHtml(ctx)}
      <div class="question question--sm">${esc(item.q || 'Кто это?')}</div>
      <div class="split">
        <div class="split-media ${revealed ? 'is-revealed' : ''}">
          ${mediaHtml(item.media, 'Загрузи фото в кабинете')}
        </div>
        ${opts.length ? `<div class="split-side">${optionsHtml(opts, item.answer, revealed)}</div>` : ''}
      </div>
      ${revealed ? answerHtml(item, opts) : ''}
      ${revealed ? noteHtml(item) : ''}
    `;
  },

  lion(ctx) {
    return ctx.phase === 'reveal'
      ? 'Ну конечно! Как я сразу не узнал.'
      : 'Присмотритесь: этот взгляд мне определённо знаком…';
  },

  remote(ctx) {
    const answer = correctText(ctx.item);
    return `
      <div class="r-question">${esc(ctx.item.q || 'Кто это?')}</div>
      ${ctx.item.media ? `<img class="r-thumb" src="${esc(ctx.item.media)}" alt="">` : ''}
      <div class="r-answer ${answer ? '' : 'is-empty'}">
        <span class="r-answer-label">На фото</span>
        <span class="r-answer-text">${answer ? esc(answer) : 'не заполнено'}</span>
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  }
};
