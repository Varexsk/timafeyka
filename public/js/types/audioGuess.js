import { optionsHtml, answerHtml, noteHtml, counterHtml, esc, correctText } from '../util.js';
import { needAnswer, noOptions } from '../engine/fields.js';
import { icon } from '../icons.js';

export default {
  id: 'audioGuess',
  accent: '#9B6BFF',
  label: 'Угадай мелодию',
  icon: 'music',
  order: 70,
  prop: { intro: 'mic', question: 'sticks', reveal: 'sticks' },
  itemFields: [
    { k: 'textarea', f: 'q', label: 'Вопрос', rows: 2 },
    { k: 'options', f: 'options', check: needAnswer },
    { k: 'text', f: 'answerText', when: noOptions,
      label: 'Правильный ответ — покажется крупно на экране' },
    { k: 'media', f: 'audio', kind: 'audio', label: 'Аудио', required: 'нет аудио' },
    { k: 'text', f: 'answerNote', label: 'Приписка к ответу (необязательно)' }
  ],

  newItem() {
    return { id: '', q: 'Что за песенка?', audio: '', options: [], answer: null, answerText: '', answerNote: '' };
  },

  mount(root, ctx) {
    const { item, phase } = ctx;
    const revealed = phase === 'reveal';
    const key = item.id + '/' + (item.audio || '');
    if (root.dataset.akey !== key) {
      root.dataset.akey = key;
      root.innerHTML = `
        ${counterHtml(ctx)}
        <div class="question">${esc(item.q || 'Что за песенка?')}</div>
        ${item.audio
          ? `<div class="equalizer">${Array.from({ length: 22 }, (_, i) => `<span style="animation-delay:${(i * 0.09).toFixed(2)}s"></span>`).join('')}
             <audio preload="auto" src="${esc(item.audio)}"></audio></div>`
          : '<div class="media-missing">Аудио ещё не загружено — добавь его в кабинете</div>'}
        <div class="js-options"></div>
        <div class="js-extra"></div>`;
    }
    const box = root.querySelector('.js-options');
    if (box) box.innerHTML = optionsHtml(item.options, item.answer, revealed);
    const extra = root.querySelector('.js-extra');
    if (extra) extra.innerHTML = revealed ? answerHtml(item, item.options) + noteHtml(item) : '';

    const audio = root.querySelector('audio');
    if (audio) root.classList.toggle('is-playing', !audio.paused);
  },

  remote(ctx) {
    const answer = correctText(ctx.item);
    return `
      <div class="r-question">${esc(ctx.item.q || 'Что за песенка?')}</div>
      <div class="r-answer ${answer ? '' : 'is-empty'}">
        <span class="r-answer-label">Правильный ответ</span>
        <span class="r-answer-text">${answer ? esc(answer) : 'не заполнен'}</span>
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
      <div class="r-media-controls">
        <button class="btn btn--ghost" data-media="play">${icon('play')} Играть</button>
        <button class="btn btn--ghost" data-media="pause">${icon('pause')} Пауза</button>
        <button class="btn btn--ghost" data-media="restart">${icon('restart')} Сначала</button>
      </div>
    `;
  }
};
