import { counterHtml, noteHtml, esc, ownerAvatar } from '../util.js';
import { icon } from '../icons.js';
import { serverNow } from '../bus.js';

// Цирковые фанты. Открылось задание — колесо само выбирает артиста среди
// играющих гостей (выступавших пропускает, пока есть новые). Ведущий судит:
// «справился» — балл семье артиста, «не справился» — аплодисменты и дальше.
// Отказался выходить — колесо крутится заново, без него.
//
// Колесо крутит сервер (см. draw и roundRedraw): оно должно выпасть одно и то
// же на всех экранах, а кто выпал, лежит в кармане вопроса — slice.who.

function guestsOf(ctx) {
  return (ctx.state && ctx.state.guests) || [];
}

function artist(ctx) {
  const id = ctx.slice && ctx.slice.who;
  return id ? guestsOf(ctx).find((g) => g.id === id) || null : null;
}

// Семья артиста — ей и балл. В зачёте по гостям — сам гость.
function ownerOf(ctx, guest) {
  if (!guest) return null;
  return ctx.owners.find((o) => o.id === guest.id) || ctx.owners.find((o) => o.id === guest.teamId) || null;
}

// Колесо этого задания ещё на экране: имя пока не объявлено.
function spinning(ctx) {
  const w = ctx.runtime && ctx.runtime.partyDraw;
  const s = ctx.slice || {};
  if (!w || !w.open || !s.drawSeq || w.seq !== s.drawSeq) return false;
  return serverNow() < (w.closeAt || w.endsAt);
}

function refusedNames(ctx) {
  const ids = (ctx.slice && ctx.slice.refused) || [];
  return ids.map((id) => (guestsOf(ctx).find((g) => g.id === id) || {}).name).filter(Boolean);
}

function sceneHtml(ctx) {
  const who = artist(ctx);
  const owner = ownerOf(ctx, who);
  const result = (ctx.slice && ctx.slice.result) || '';
  const spin = spinning(ctx);
  const lion = esc((ctx.names && ctx.names.lion) || 'Лёва');

  const star = who && !spin
    ? `<div class="challenge-artist pop-in">
        ${ownerAvatar(who, 'challenge-av')}
        <div><div class="challenge-label">На арене</div>
          <div class="challenge-name">${esc(who.name)}</div>
          ${owner && owner.id !== who.id ? `<div class="challenge-team">${esc(owner.name)}</div>` : ''}</div>
      </div>`
    : `<div class="hint">${spin ? 'Крутим колесо — кто выйдет на арену?' : 'Ведущий крутит колесо'}</div>`;

  let verdict = '';
  if (result === 'pass') {
    verdict = `<div class="answer-card pop-in">Браво! ${icon('star-fill')} +${ctx.points}${owner ? ' — ' + esc(owner.name) : ''}</div>`;
  } else if (result === 'fail') {
    verdict = '<div class="answer-note fade-in">В этот раз не вышло — но аплодисменты за смелость!</div>';
  }

  return `<div class="challenge-scene">
      ${counterHtml(ctx)}
      ${star}
      <div class="ticket pop-in">
        <div class="ticket-label">${lion} объявляет задание</div>
        <div class="ticket-text">${esc(ctx.item.q)}</div>
      </div>
      ${verdict}
      ${ctx.phase === 'reveal' ? noteHtml(ctx.item) : ''}
    </div>`;
}

export default {
  id: 'challenge',
  accent: '#D9631B',
  label: 'Фанты и задания',
  icon: 'hat',
  order: 80,
  prop: { intro: 'mic', question: 'whistle', reveal: 'whistle' },
  itemNoun: 'задание',
  itemFields: [
    { k: 'textarea', f: 'q', label: 'Задание', rows: 2 },
    { k: 'text', f: 'answerNote', label: 'Приписка к ответу (необязательно)' }
  ],

  // Балл за фант ставит ведущий кнопкой «Справился» — правильного ответа тут нет.
  scoring: { rule: 'manual' },
  // Открылось задание — сервер сам крутит колесо. Через 2,5 с после остановки
  // колесо уходит с экрана, и видно задание с именем артиста.
  draw: { linger: 2500 },

  newContest() {
    return {
      title: 'Цирковые фанты',
      rules: 'Колесо выбирает артиста, Лёва даёт задание. Справился — балл семье!'
    };
  },

  newItem() {
    return { id: '', q: 'Новое задание', answerNote: '' };
  },

  // Через mount, а не stage: сцена меняется от кармана вопроса (кто выпал,
  // что решил ведущий), а stage перерисовывается только от ответов.
  mount(root, ctx) {
    const html = sceneHtml(ctx);
    const own = root.firstElementChild && root.firstElementChild.classList.contains('challenge-scene');
    if (own && root._challengeHtml === html) return;
    root._challengeHtml = html;
    root.innerHTML = html;
    // Колесо ещё крутится — перерисуем, когда оно уйдёт с экрана.
    clearTimeout(root._challengeWake);
    const w = ctx.runtime && ctx.runtime.partyDraw;
    if (spinning(ctx) && w) {
      root._challengeWake = setTimeout(() => {
        if (root._challengeHtml === html) { root._challengeHtml = ''; this.mount(root, ctx); }
      }, Math.max(0, (w.closeAt || w.endsAt) - serverNow()) + 50);
    }
  },

  stage(ctx) {
    return sceneHtml(ctx);
  },

  lion(ctx) {
    const result = ctx.slice && ctx.slice.result;
    if (result === 'pass') return 'Браво! Вот это номер, я такого даже в Париже не видел!';
    if (result === 'fail') return 'Ничего-ничего, в цирке главное — смелость!';
    return artist(ctx) ? 'Смелее! Арена ждёт своего героя.' : 'Кто же выйдет на арену?..';
  },

  remote(ctx) {
    const who = artist(ctx);
    const owner = ownerOf(ctx, who);
    const result = (ctx.slice && ctx.slice.result) || '';
    const refused = refusedNames(ctx);
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-note">На арене: ${who
    ? `<b>${esc(who.name)}</b>${owner && owner.id !== who.id ? ` · ${esc(owner.name)}` : ''}`
    : 'пока никто — крутим колесо'}</div>
      ${refused.length ? `<div class="r-note">Отказались: ${refused.map(esc).join(', ')}</div>` : ''}
      ${who ? `
      <div class="r-media-controls">
        <button class="btn ${result === 'pass' ? 'btn--primary is-on' : 'btn--primary'}" data-act="pass">${icon('check')} Справился +${ctx.points}</button>
        <button class="btn ${result === 'fail' ? 'btn--purple is-on' : 'btn--ghost'}" data-act="fail">${icon('cross')} Не справился</button>
      </div>
      ${result ? `<div class="r-note">${result === 'pass'
    ? `Засчитано: +${ctx.points}${owner ? ' — ' + esc(owner.name) : ''}. Передумал — жми «Не справился», балл снимется.`
    : 'Не засчитано. Передумал — жми «Справился».'}</div>` : ''}` : ''}
      <div class="r-media-controls">
        ${who ? `<button class="btn btn--ghost" data-act="refuse">${icon('refresh')} Отказался — крутим заново</button>` : ''}
        <button class="btn btn--ghost" data-act="spin">${icon('users')} ${who ? 'Просто крутить ещё раз' : 'Крутить колесо'}</button>
      </div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  },

  actions: {
    pass(ctx, api) { judge(api, 'pass'); },
    fail(ctx, api) { judge(api, 'fail'); },
    refuse(ctx, api) {
      api.send('roundRedraw', { refused: true }).then((r) => {
        if (r && r.ok === false) api.toast(r.error || 'Не получилось');
      });
    },
    spin(ctx, api) {
      api.send('roundRedraw', { refused: false }).then((r) => {
        if (r && r.ok === false) api.toast(r.error || 'Не получилось');
      });
    }
  }
};

function judge(api, result) {
  api.send('roundJudge', { result }).then((r) => {
    if (r && r.ok === false) api.toast(r.error || 'Не получилось');
    else api.toast(result === 'pass' ? 'Балл засчитан!' : 'Не засчитано');
  });
}
