import { noteHtml, counterHtml, esc, ownerAvatar } from '../util.js';

// «Кто это сказал»: на экране — слова одного из гостей, остальные угадывают
// автора. Вариантов ответа нет: гости выбирают автора из списка гостей
// праздника прямо на телефоне, а в кабинете отмечается только, кто сказал.

function guestsOf(ctx) {
  return (ctx.state && ctx.state.guests) || [];
}

function authorOf(ctx) {
  return guestsOf(ctx).find((g) => g.id === ctx.item.author) || null;
}

// Кого называли чаще всего. Считаем людей, а не семьи: у семьи один голос
// в зачёте, но интереснее видеть, как думал весь стол.
function guesses(ctx) {
  const count = {};
  for (const vote of Object.values((ctx.round && ctx.round.votes) || {})) {
    const voices = vote && vote.by ? Object.values(vote.by) : [vote];
    for (const voice of voices) {
      if (!voice || !voice.v) continue;
      count[voice.v] = (count[voice.v] || 0) + 1;
    }
  }
  return guestsOf(ctx)
    .filter((g) => count[g.id])
    .map((g) => ({ guest: g, n: count[g.id] }))
    .sort((a, b) => b.n - a.n);
}

export default {
  id: 'quotes',
  accent: '#6F42D4',
  label: 'Кто это сказал',
  icon: 'quote',
  order: 50,
  prop: { intro: 'mic', question: 'ticket', reveal: 'ticket' },
  itemFields: [
    { k: 'textarea', f: 'q', label: 'Цитата', rows: 2 },
    { k: 'guest', f: 'author', label: 'Кто это сказал',
      hint: 'Гости выберут автора из списка всех гостей праздника.',
      check: (it, contest, state) => {
        if (!it.author) return 'не выбран автор';
        const list = (state && state.guests) || [];
        return list.length && !list.some((g) => g.id === it.author) ? 'автора нет среди гостей' : null;
      } },
    { k: 'text', f: 'answerNote', label: 'Приписка к ответу (необязательно)' }
  ],

  scoring: { rule: 'exact', field: 'author' },
  participation: { vote: { kind: 'guest' } },

  newItem() {
    return { id: '', q: 'Новая цитата', author: '', answerNote: '' };
  },

  stage(ctx) {
    const { item, phase } = ctx;
    const revealed = phase === 'reveal';
    const author = authorOf(ctx);
    const top = revealed ? guesses(ctx).slice(0, 4) : [];
    return `
      ${counterHtml(ctx)}
      <div class="quote pop-in">
        <span class="quote-mark quote-mark--l">«</span>
        <div class="quote-text">${esc(item.q)}</div>
        <span class="quote-mark quote-mark--r">»</span>
      </div>
      ${!revealed
    ? `<div class="quote-ask">${ctx.playMode === 'phones' ? 'Кто это сказал? Выбирайте автора на телефонах' : 'Кто это сказал?'}</div>`
    : author
      ? `<div class="quote-author pop-in">${ownerAvatar(author, 'quote-author-av')}<span>${esc(author.name)}</span></div>`
      : '<div class="answer-empty">Автор не выбран — отметь его в кабинете</div>'}
      ${top.length ? `<div class="quote-guesses fade-in">${top.map((t) => `
        <span class="quote-guess ${author && t.guest.id === author.id ? 'is-right' : ''}">${esc(t.guest.name)} <b>${t.n}</b></span>`).join('')}
      </div>` : ''}
      ${revealed ? noteHtml(item) : ''}
    `;
  },

  lion(ctx) {
    return ctx.phase === 'reveal'
      ? 'Ну конечно! Я сразу узнал этот голос.'
      : 'Кто-то из вас это сказал. Признавайтесь!';
  },

  remote(ctx) {
    const author = authorOf(ctx);
    return `
      <div class="r-question">«${esc(ctx.item.q)}»</div>
      <div class="r-answer ${author ? '' : 'is-empty'}">
        <span class="r-answer-label">Это сказал</span>
        <span class="r-answer-text">${author ? esc(author.name) : 'не заполнено'}</span>
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  }
};
