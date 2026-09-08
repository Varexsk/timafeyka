// Телефон гостя. Открывается по QR-коду с телевизора.
//
// Правильных ответов эта страница не знает: сервер их не присылает
// (см. server/project.js). Всё, что здесь есть, — вопрос, варианты и своя
// кнопка «ответить».

import * as bus from './bus.js';
import { loadTypes, getType } from './engine/registry.js';
import { playModeOf } from './engine/ctx.js';
import { clock, leftSeconds } from './engine/timer.js';
import { esc, names, LETTERS } from './util.js';
import { mountSprite, icon } from './icons.js';
import { mountArtSprite, art, hasArt } from './art.js';
import { mountAvatarSprite, avatar, hasAvatar } from './avatars.js';

await loadTypes();

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'cirk.player';

let state = null;
let me = restore();
let joined = false;

// ——— кто я ———

function restore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    return saved && saved.playerId && saved.ownerId ? saved : null;
  } catch (e) {
    return null;   // приватное окно или запрет на хранилище — просто спросим заново
  }
}

function remember(next) {
  me = next;
  try {
    if (next) localStorage.setItem(STORE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORE_KEY);
  } catch (e) { /* переживём */ }
}

function newPlayerId() {
  return 'p-' + Math.random().toString(36).slice(2, 10);
}

// Кто получает баллы: семьи или каждый гость отдельно.
function owners() {
  if (!state) return [];
  const mode = (state.show && state.show.mode) || 'teams';
  return (mode === 'guests' ? state.guests : state.teams) || [];
}

function myOwner() {
  return me ? owners().find((o) => o.id === me.ownerId) || null : null;
}

// ——— мелочи ———

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-on'), 1400);
}

function buzz(ms) {
  if (navigator.vibrate) navigator.vibrate(ms || 12);
}

function avatarHtml(o) {
  const inner = hasAvatar(o.avatar)
    ? avatar(o.avatar)
    : `<span>${esc(o.emoji || '')}</span>`;
  return inner;
}

function optionPic(o) {
  if (o && o.icon && hasArt(o.icon)) return `<span class="pic">${art(o.icon)}</span>`;
  return '';
}

// ——— текущий вопрос ———

function current() {
  const r = (state && state.runtime) || {};
  const contest = ((state.show && state.show.contests) || []).find((c) => c.id === r.contestId) || null;
  const items = (contest && contest.items) || [];
  const item = items.find((it) => it.id === r.itemId) || null;
  return {
    runtime: r,
    contest,
    item,
    type: contest ? getType(contest.type) : null,
    round: r.round || null,
    mode: playModeOf(state, contest)
  };
}

function voteDecl(type) {
  const p = (type && type.participation) || {};
  return p.vote || null;
}

// ——— экраны ———

function renderPick() {
  const list = owners();
  const teams = ((state.show && state.show.mode) || 'teams') === 'teams';
  const taken = {};
  for (const p of Object.values((state.play && state.play.players) || {})) {
    taken[p.ownerId] = (taken[p.ownerId] || 0) + 1;
  }

  return `
    <div class="p-title">Кто ты?</div>
    <div class="p-hint">${teams
    ? 'Выбери свою семью. Если у вас несколько телефонов — жмите одну и ту же карточку.'
    : 'Найди себя в списке.'}</div>
    <div class="p-pick">
      ${list.map((o) => `
        <button data-pick="${esc(o.id)}" style="--c:${esc(o.color || 'var(--ink)')}">
          <span class="av">${avatarHtml(o)}</span>
          <span>${esc(o.name)}</span>
          ${taken[o.id] ? `<span class="busy">уже ${taken[o.id]} ${taken[o.id] === 1 ? 'телефон' : 'телефона'}</span>` : ''}
        </button>`).join('')}
    </div>
    ${list.length ? '' : '<div class="p-hint">Ведущий ещё не завёл участников — подожди чуть-чуть.</div>'}
  `;
}

function renderWaiting(text, hint) {
  return `
    <div class="p-card">
      <div class="p-title">${esc(text)}</div>
      ${hint ? `<div class="p-hint" style="margin-top:.4rem">${esc(hint)}</div>` : ''}
    </div>`;
}

function renderChoice(ctx) {
  const opts = (ctx.item.options || []);
  const round = ctx.round || {};
  const revealed = ctx.runtime.phase === 'reveal';
  const correct = (ctx.runtime.correct || {}).answer;
  const mine = round.mine;

  const tally = {};
  if (revealed && round.votes) {
    for (const v of Object.values(round.votes)) {
      const key = String(v.v);
      tally[key] = (tally[key] || 0) + 1;
    }
  }

  return `
    <div class="p-question">${esc(ctx.item.q || '')}</div>
    <div class="p-options">
      ${opts.map((o, i) => {
    let cls = 'p-opt';
    if (mine === i) cls += ' is-mine';
    if (revealed && Number.isInteger(correct)) cls += i === correct ? ' is-right' : ' is-wrong';
    return `<button class="${cls}" data-choice="${i}" ${revealed ? 'disabled' : ''}>
          <span class="letter">${LETTERS[i] || i + 1}</span>
          ${optionPic(o)}
          <span class="label">${esc(typeof o === 'string' ? o : o.text)}</span>
          ${tally[String(i)] ? `<span class="tally">${tally[String(i)]}</span>` : ''}
        </button>`;
  }).join('')}
    </div>
    ${revealed ? revealHint(ctx, mine === correct) : answeredHint(round, mine !== undefined)}
  `;
}

function renderNumber(ctx) {
  const round = ctx.round || {};
  const revealed = ctx.runtime.phase === 'reveal';
  const unit = (ctx.item.unit || '').trim();
  const mine = round.mine;

  if (revealed) {
    const right = (ctx.runtime.correct || {}).value;
    return `
      <div class="p-question">${esc(ctx.item.q || '')}</div>
      <div class="p-card">
        <div class="p-hint">Правильный ответ</div>
        <div class="p-title">${right === null || right === undefined ? '—' : esc(right)}${unit ? ' ' + esc(unit) : ''}</div>
        ${mine === undefined ? '' : `<div class="p-hint" style="margin-top:.4rem">Ты называл ${esc(mine)}</div>`}
      </div>`;
  }

  return `
    <div class="p-question">${esc(ctx.item.q || '')}</div>
    <div class="p-number">
      <input type="number" inputmode="numeric" id="numIn"
             value="${mine === undefined ? '' : esc(mine)}" placeholder="${esc(unit || 'число')}">
      <button class="p-big" data-send="number" style="flex:0 0 auto;width:8rem">Ставлю!</button>
    </div>
    ${answeredHint(round, mine !== undefined)}
  `;
}

function answeredHint(round, sent) {
  const total = owners().length;
  const done = round.answered || 0;
  return `<div class="p-hint">${sent ? 'Ответ принят. Можно передумать — жми другой.' : 'Выбирай!'}
    ${total ? ` · ответили ${done} из ${total}` : ''}</div>`;
}

function revealHint(ctx, right) {
  if (ctx.round && ctx.round.mine === undefined) {
    return '<div class="p-hint">В этот раз вы не ответили.</div>';
  }
  return right
    ? '<div class="p-title" style="font-size:1.4rem">Угадали!</div>'
    : '<div class="p-hint">В этот раз мимо. Ничего, впереди ещё номера!</div>';
}

function renderPlay() {
  const ctx = current();
  const r = ctx.runtime;

  if (r.screen !== 'show') {
    const where = {
      welcome: ['Скоро начнём!', 'Смотри на большой экран.'],
      guests: ['Знакомимся', 'Смотри на большой экран.'],
      leaderboard: ['Считаем звёздочки', 'Смотри на большой экран.'],
      finale: ['Финал!', 'Смотри на большой экран.'],
      diploma: ['Награждение', 'Смотри на большой экран.']
    }[r.screen] || ['Смотри на большой экран', ''];
    return renderWaiting(where[0], where[1]);
  }

  if (!ctx.contest) return renderWaiting('Ждём следующий номер', '');

  if (ctx.mode !== 'phones') {
    return renderWaiting('Отвечаем вслух!',
      'Этот номер ведущий ведёт сам — телефон не нужен, смотри на большой экран.');
  }

  if (r.phase === 'intro' || !ctx.item) {
    return `
      <div class="p-card">
        <div class="p-hint">${esc(ctx.contest.subtitle || 'Следующий номер')}</div>
        <div class="p-title">${esc(ctx.contest.title)}</div>
        ${ctx.contest.rules ? `<div class="p-hint" style="margin-top:.4rem">${esc(ctx.contest.rules)}</div>` : ''}
      </div>
      <div class="p-hint">Приготовься — сейчас будет вопрос.</div>`;
  }

  const vote = voteDecl(ctx.type);
  if (!vote) {
    return renderWaiting('Смотри на большой экран',
      'В этом номере с телефона отвечать не нужно.');
  }
  if (vote.kind === 'number') return renderNumber(ctx);
  if (vote.kind === 'choice') return renderChoice(ctx);
  return renderWaiting('Смотри на большой экран', '');
}

// ——— отрисовка ———

function renderTimer() {
  const box = $('playTimer');
  const t = state && state.runtime && state.runtime.timer;
  if (!t) { box.innerHTML = ''; box.className = 'p-timer'; return; }
  const left = leftSeconds(t);
  box.className = 'p-timer' + (t.running && left <= 3 ? ' is-warn' : '');
  box.innerHTML = `<span class="t-num">${clock(t)}</span>
    <span>${esc(t.label || (t.running ? 'время идёт' : left > 0 ? 'пауза' : 'время вышло'))}</span>`;
}

function render() {
  if (!state) return;
  const owner = myOwner();

  document.body.classList.toggle('is-rehearsal', !!state.runtime.rehearsal);

  if (!owner) {
    $('myAvatar').innerHTML = icon('users');
    $('myName').textContent = 'Кто ты?';
    $('mySub').textContent = names(state).title;
    $('myScore').textContent = '';
    $('playBody').innerHTML = renderPick();
    renderTimer();
    return;
  }

  $('myAvatar').innerHTML = avatarHtml(owner);
  $('myAvatar').style.setProperty('--c', owner.color || 'var(--ink)');
  $('myName').textContent = owner.name;
  $('mySub').textContent = state.runtime.rehearsal ? 'репетиция' : names(state).title;
  $('myScore').textContent = owner.score || 0;
  $('playBody').innerHTML = renderPlay();
  renderTimer();
}

// ——— связь ———

function connect() {
  bus.start('play', me ? me.ownerId : '');
}

function pick(ownerId) {
  remember({ playerId: (me && me.playerId) || newPlayerId(), ownerId });
  joined = false;
  connect();
  render();
}

function ensureJoined() {
  if (joined || !me || !myOwner()) return;
  joined = true;
  bus.send('join', { playerId: me.playerId, ownerId: me.ownerId });
}

function sendVote(value) {
  if (!me) return;
  bus.send('vote', { ownerId: me.ownerId, value });
}

// ——— события ———

document.body.addEventListener('click', (e) => {
  const pickBtn = e.target.closest('[data-pick]');
  if (pickBtn) { buzz(); pick(pickBtn.dataset.pick); return; }

  const choice = e.target.closest('[data-choice]');
  if (choice) {
    buzz(18);
    sendVote(Number(choice.dataset.choice));
    toast('Ответ принят!');
    return;
  }

  const send = e.target.closest('[data-send]');
  if (send && send.dataset.send === 'number') {
    const input = $('numIn');
    if (!input || input.value === '') { toast('Впиши число'); return; }
    buzz(18);
    sendVote(input.value);
    toast('Ставка принята!');
  }
});

mountSprite();
mountArtSprite();
mountAvatarSprite();

bus.onStatus((ok) => document.body.classList.toggle('is-offline', !ok));
bus.onState((next) => {
  state = next;
  ensureJoined();
  render();
});
connect();

// Цифра таймера должна тикать и без новых кадров с сервера.
setInterval(renderTimer, 250);

// Уходя со страницы, отвязываем телефон — иначе список игроков зарастёт.
window.addEventListener('pagehide', () => {
  if (me && navigator.sendBeacon) {
    navigator.sendBeacon('/api/command', new Blob(
      [JSON.stringify({ type: 'leave', payload: { playerId: me.playerId } })],
      { type: 'application/json' }
    ));
  }
});
