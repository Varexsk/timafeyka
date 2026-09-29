// Телефон гостя. Открывается по QR-коду с телевизора.
//
// Правильных ответов эта страница не знает: сервер их не присылает
// (см. server/project.js). Всё, что здесь есть, — вопрос, варианты и своя
// кнопка «ответить».

import * as bus from './bus.js';
import { loadTypes, getType } from './engine/registry.js';
import { playModeOf } from './engine/ctx.js';
import { clock, leftSeconds } from './engine/timer.js';
import { esc, names, LETTERS, optionsOf, fmtScore } from './util.js';
import { mountSprite, icon } from './icons.js';
import { mountArtSprite, art, hasArt } from './art.js';
import { mountAvatarSprite, avatar, hasAvatar, isPhotoAvatar, photoAvatar } from './avatars.js';

await loadTypes();

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'cirk.player';

let state = null;
let me = restore();
let joined = false;
let bodyWhere = '';

// Задержка до сервера. Нужна честной жужжалке: у кого-то Wi-Fi лучше,
// и сервер вычитает половину этого числа из времени нажатия.
let rtt = 0;

function ping() {
  const started = Date.now();
  fetch('/api/ping')
    .then((r) => r.json())
    .then(() => {
      const sample = Date.now() - started;
      rtt = rtt ? Math.round(rtt * 0.7 + sample * 0.3) : sample;
    })
    .catch(() => { /* сеть моргнула — попробуем через пять секунд */ });
}

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

// Выбрал семью, но ещё не сказал, кто ты в ней. В режиме «по гостям» второй
// вопрос не нужен: там семья и человек — одно и то же.
function needsPerson() {
  if (!me || me.guestId !== undefined) return false;
  return ((state.show && state.show.mode) || 'teams') === 'teams' && familyMembers().length > 0;
}

// Кто из семьи выходит на конкурсы. Болельщиков не предлагаем: за них
// всё равно никто не отвечает.
function familyMembers() {
  if (!me || !state) return [];
  return (state.guests || []).filter((g) => g.teamId === me.ownerId && g.playing !== false);
}

function myPerson() {
  return me && me.guestId ? (state.guests || []).find((g) => g.id === me.guestId) || null : null;
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
  if (isPhotoAvatar(o.avatar)) return photoAvatar(o.avatar);
  return hasAvatar(o.avatar) ? avatar(o.avatar) : `<span>${esc(o.emoji || '')}</span>`;
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

function renderPickPerson() {
  const owner = myOwner();
  const taken = {};
  for (const p of Object.values((state.play && state.play.players) || {})) {
    if (p.guestId && p.id !== (me && me.playerId)) taken[p.guestId] = p.id;
  }

  return `
    <div class="p-title">Кто из семьи?</div>
    <div class="p-hint">Семья «${esc(owner ? owner.name : '')}». Баллы всё равно общие — имя нужно,
      чтобы ведущий видел, кто что ответил, и чтобы в конце выбрать главного знатока.</div>
    <div class="p-pick">
      ${familyMembers().map((g) => `
        <button data-person="${esc(g.id)}" style="--c:${esc(g.color || owner && owner.color || 'var(--ink)')}">
          <span class="av">${avatarHtml(g)}</span>
          <span>${esc(g.name)}</span>
          ${taken[g.id] ? '<span class="busy">уже с телефона</span>' : ''}
        </button>`).join('')}
    </div>
    <button class="p-big" data-person="" style="margin-top:.6rem">Мы отвечаем вместе с одного телефона</button>
    <button class="p-link" data-back="1">← другая семья</button>
  `;
}

function renderWaiting(text, hint) {
  return `
    <div class="p-card">
      <div class="p-title">${esc(text)}</div>
      ${hint ? `<div class="p-hint" style="margin-top:.4rem">${esc(hint)}</div>` : ''}
    </div>`;
}

// Пока жужжалка открыта, она важнее всего остального на экране.
function renderBuzzer(ctx, b) {
  const order = b.order || [];
  const at = order.findIndex((x) => x.ownerId === me.ownerId);
  const blocked = (b.falseStart || 0) > Date.now();

  if (at === 0) {
    return `<div class="p-card">
        <div class="p-place">1</div>
        <div class="p-title" style="text-align:center">Вы первые!</div>
        <div class="p-hint" style="text-align:center">Отвечайте вслух — ведущий слушает.</div>
      </div>`;
  }
  if (at > 0) {
    return `<div class="p-card">
        <div class="p-place">${at + 1}</div>
        <div class="p-title" style="text-align:center">Вы ${at + 1}-е в очереди</div>
        <div class="p-hint" style="text-align:center">Если предыдущие ошибутся — очередь дойдёт до вас.</div>
      </div>`;
  }
  if (blocked) {
    return `<div class="p-card">
        <div class="p-title" style="text-align:center">Фальстарт!</div>
        <div class="p-hint" style="text-align:center">Нажали до сигнала. Пара секунд — и можно снова.</div>
      </div>`;
  }
  if (!b.open) {
    return `<div class="p-card">
        <div class="p-title" style="text-align:center">В этот раз не успели</div>
        <div class="p-hint" style="text-align:center">Ждём следующий вопрос.</div>
      </div>`;
  }
  return `${ctx.item ? `<div class="p-question">${esc(ctx.item.q || '')}</div>` : ''}
    <button class="p-buzz" data-buzz="1">ЖМИ!</button>`;
}

// Что ответил именно этот телефон. Ответ семьи — не то же самое: ты назвал
// 3200, бабушка 3300, а в зачёт пошло среднее. Когда за семью отвечает ведущий
// с пульта, поимённых ответов нет — тогда ответ семьи и есть твой.
function myAnswer(round) {
  if (!round || !round.family) return round ? round.mine : undefined;
  const own = me && round.family[me.playerId];
  return own ? own.v : undefined;
}

// Кто ещё из семьи уже ответил — и что из этого сложилось. Без этой строки
// непонятно, почему семье засчитали не то, что ты нажал.
function familyLine(round, label) {
  const by = round && round.family;
  if (!by) return '';
  const players = (state && state.play && state.play.players) || {};
  const others = Object.entries(by).filter(([id]) => !me || id !== me.playerId);
  if (!others.length) return '';
  const list = others
    .map(([id, e]) => esc((players[id] || {}).name || 'Гость') + ' — ' + esc(label(e.v)))
    .join(' · ');
  return `<div class="p-hint">В семье: ${list} · семье засчитано <b>${esc(label(round.mine))}</b></div>`;
}

function optionLabel(opts, value) {
  const o = opts[Number(value)];
  if (o === undefined || o === null) return '—';
  return typeof o === 'string' ? o : o.text || String(value);
}

function renderChoice(ctx) {
  const opts = optionsOf(ctx.type, ctx.item);
  const round = ctx.round || {};
  const revealed = ctx.runtime.phase === 'reveal';
  // Ролик с выбором уже идёт — ответ на экране виден, менять его поздно.
  const closed = revealed || !!ctx.runtime.rolling;
  const correct = (ctx.runtime.correct || {}).answer;
  const mine = myAnswer(round);

  const tally = {};
  if (revealed && round.votes) {
    for (const v of Object.values(round.votes)) {
      const key = String(v.v);
      tally[key] = (tally[key] || 0) + 1;
    }
  }

  const hidden = round.hidden || [];

  return `
    <div class="p-question">${esc(ctx.item.q || '')}</div>
    <div class="p-options">
      ${opts.map((o, i) => {
    let cls = 'p-opt';
    if (mine === i) cls += ' is-mine';
    if (hidden.includes(i)) cls += ' is-out';
    if (revealed && Number.isInteger(correct)) cls += i === correct ? ' is-right' : ' is-wrong';
    return `<button class="${cls}" data-choice="${i}" ${closed || hidden.includes(i) ? 'disabled' : ''}>
          <span class="letter">${LETTERS[i] || i + 1}</span>
          ${optionPic(o)}
          <span class="label">${esc(typeof o === 'string' ? o : o.text)}</span>
          ${tally[String(i)] ? `<span class="tally">${tally[String(i)]}</span>` : ''}
        </button>`;
  }).join('')}
    </div>
    ${revealed ? revealHint(ctx, mine === correct)
    : closed ? '<div class="p-hint">Смотрим видео — ответы закрыты. Сейчас узнаем!</div>'
      : answeredHint(round, mine !== undefined)}
    ${familyLine(round, (v) => optionLabel(opts, v))}
    ${audienceHtml(ctx, opts)}
    ${jokersHtml(ctx, closed)}
  `;
}

// Расклад голосов у той семьи, которая потратила «помощь зала». На телевизоре
// он мелькает крупно и уходит, а здесь остаётся: решать-то им.
function audienceHtml(ctx, opts) {
  const tally = ctx.round && ctx.round.audience;
  if (!tally || ctx.runtime.phase === 'reveal') return '';
  const total = Object.values(tally).reduce((sum, n) => sum + n, 0);
  return `<div class="p-audience">
    <div class="p-hint">Помощь зала${total ? '' : ' · зал ещё думает'}</div>
    ${opts.map((o, i) => {
    const share = total ? Math.round(((tally[i] || 0) / total) * 100) : 0;
    return `<div class="p-audience-row">
        <span>${LETTERS[i] || i + 1}</span>
        <span class="p-audience-bar"><span style="width:${share}%"></span></span>
        <b>${share}%</b>
      </div>`;
  }).join('')}
  </div>`;
}

// Два джокера на семью за весь вечер. Тратит один человек — помогает всем:
// баллы-то общие.
function jokersHtml(ctx, revealed) {
  if (revealed || ctx.mode !== 'phones') return '';
  const used = ctx.runtime.jokers || {};
  const audience = (ctx.round && ctx.round.audience) || false;
  const options = optionsOf(ctx.type, ctx.item).length;
  return `<div class="p-jokers">
    <button class="p-joker" data-joker="fifty" ${used.fifty || options < 4 ? 'disabled' : ''}>
      <b>50 на 50</b><small>${used.fifty ? 'потрачен' : options < 4 ? 'нужно 4 варианта' : 'убрать два неверных'}</small>
    </button>
    <button class="p-joker" data-joker="audience" ${used.audience ? 'disabled' : ''}>
      <b>Помощь зала</b><small>${used.audience ? 'потрачен' : audience ? 'уже на экране' : 'как ответили другие'}</small>
    </button>
  </div>`;
}

function renderText(ctx) {
  const round = ctx.round || {};
  const own = myAnswer(round);
  const mine = own === undefined ? '' : String(own);
  const vote = voteDecl(ctx.type) || {};
  return `
    <div class="p-question">${esc(ctx.item.q || '')}</div>
    <textarea class="p-text" id="textIn" rows="4"
      placeholder="${esc(vote.placeholder || 'Напиши тут…')}">${esc(mine)}</textarea>
    <button class="p-big" data-send="text">Отправить</button>
    ${mine ? '<div class="p-hint">Уже отправлено. Можно переписать и отправить снова.</div>' : ''}
  `;
}

// «Кто это сказал»: автор выбирается из выпадающего списка гостей,
// сгруппированного по семьям. Себя в списке нет — свои слова гость и так знает.
function renderGuest(ctx) {
  const round = ctx.round || {};
  const revealed = ctx.runtime.phase === 'reveal';
  const mine = myAnswer(round);
  const guests = state.guests || [];
  const teams = state.teams || [];
  const nameOf = (id) => (guests.find((g) => g.id === id) || {}).name || '—';
  const quote = `<div class="p-question">«${esc(ctx.item.q || '')}»</div>`;

  if (revealed) {
    const right = (ctx.runtime.correct || {}).author || '';
    return `${quote}
      <div class="p-card">
        <div class="p-hint">Это сказал</div>
        <div class="p-title">${right ? esc(nameOf(right)) : '—'}</div>
        ${mine === undefined ? '' : `<div class="p-hint" style="margin-top:.4rem">Твой выбор: ${esc(nameOf(mine))}</div>`}
      </div>
      ${revealHint(ctx, !!right && mine === right)}
      ${familyLine(round, nameOf)}`;
  }

  const self = me && me.guestId;
  const others = guests.filter((g) => g.id !== self);
  const opt = (g) => `<option value="${esc(g.id)}"${g.id === mine ? ' selected' : ''}>${esc(g.name)}</option>`;
  const groups = teams.map((t) => {
    const own = others.filter((g) => g.teamId === t.id);
    return own.length ? `<optgroup label="${esc(t.name)}">${own.map(opt).join('')}</optgroup>` : '';
  }).join('');
  const loose = others.filter((g) => !teams.some((t) => t.id === g.teamId)).map(opt).join('');
  return `${quote}
    <select class="p-select" data-guest-pick aria-label="Кто это сказал?">
      <option value=""${mine === undefined ? ' selected' : ''} disabled>Кто это сказал? Выбери…</option>
      ${groups}${loose}
    </select>
    ${answeredHint(round, mine !== undefined)}
    ${familyLine(round, nameOf)}`;
}

function renderNumber(ctx) {
  const round = ctx.round || {};
  const revealed = ctx.runtime.phase === 'reveal';
  const unit = (ctx.item.unit || '').trim();
  const mine = myAnswer(round);
  const family = round.mine;

  if (revealed) {
    const right = (ctx.runtime.correct || {}).value;
    return `
      <div class="p-question">${esc(ctx.item.q || '')}</div>
      <div class="p-card">
        <div class="p-hint">Правильный ответ</div>
        <div class="p-title">${right === null || right === undefined ? '—' : esc(right)}${unit ? ' ' + esc(unit) : ''}</div>
        ${mine === undefined ? '' : `<div class="p-hint" style="margin-top:.4rem">Ты называл ${esc(mine)}</div>`}
        ${family !== undefined && String(family) !== String(mine)
    ? `<div class="p-hint">Семья назвала ${esc(family)}${unit ? ' ' + esc(unit) : ''}</div>`
    : ''}
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
    ${familyLine(round, (v) => String(v))}
  `;
}

function answeredHint(round, sent) {
  const total = owners().length;
  const done = round.answered || 0;
  return `<div class="p-hint">${sent ? 'Ответ принят. Можно передумать — жми другой.' : 'Выбирай!'}
    ${total ? ` · ответили ${done} из ${total}` : ''}</div>`;
}

function revealHint(ctx, right) {
  if (ctx.round && myAnswer(ctx.round) === undefined) {
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

  // Жужжалка работает поверх любого формата — её открывает ведущий.
  const b = (ctx.round && ctx.round.buzz) || null;
  if (b && (b.open || (b.order || []).length || (b.falseStart || 0) > Date.now())) {
    return renderBuzzer(ctx, b);
  }

  const vote = voteDecl(ctx.type);
  if (!vote) {
    return renderWaiting('Смотри на большой экран',
      'В этом номере с телефона отвечать не нужно.');
  }
  if (vote.kind === 'number') return renderNumber(ctx);
  if (vote.kind === 'text') return renderText(ctx);
  if (vote.kind === 'choice') return renderChoice(ctx);
  if (vote.kind === 'guest') return renderGuest(ctx);
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
  $('capsuleLink').hidden = !state.show.capsule?.open;
  $('capsuleLink').style.display = state.show.capsule?.open ? 'block' : 'none';
  if (state.runtime.intermission?.open) { renderWaiting('Антракт', 'Отдыхаем — ведущий скоро продолжит праздник.'); renderTimer(); return; }
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

  if (needsPerson()) {
    $('myAvatar').innerHTML = avatarHtml(owner);
    $('myAvatar').style.setProperty('--c', owner.color || 'var(--ink)');
    $('myName').textContent = owner.name;
    $('mySub').textContent = 'кто ты в семье?';
    $('myScore').textContent = '';
    $('playBody').innerHTML = renderPickPerson();
    renderTimer();
    return;
  }

  const person = myPerson();
  $('myAvatar').innerHTML = avatarHtml(person || owner);
  $('myAvatar').style.setProperty('--c', owner.color || 'var(--ink)');
  $('myName').textContent = person ? person.name : owner.name;
  $('mySub').textContent = state.runtime.rehearsal ? 'репетиция'
    : person ? owner.name : names(state).title;
  $('myScore').textContent = fmtScore(owner.score);
  // Гость как раз выбирает в списке или печатает ответ — не перерисовываем
  // у него под пальцами: ответы других приходят постоянно, и открытый список
  // захлопывался бы, а набранный текст пропадал. Сменился вопрос — рисуем.
  const r = state.runtime;
  const where = [r.screen, r.contestId, r.itemId, r.phase, r.rolling ? 1 : 0].join('|');
  const focus = document.activeElement;
  const busy = focus && $('playBody').contains(focus) && /^(SELECT|INPUT|TEXTAREA)$/.test(focus.tagName);
  if (!busy || where !== bodyWhere) $('playBody').innerHTML = renderPlay();
  bodyWhere = where;
  renderTimer();
  renderBooth();
}

// ——— фотобудка ———
//
// Единственный канал от гостя, кроме ответов: снимок с телефона. Уходит на
// сервер как обычный файл, а оттуда — в программу и в семейный альбом.

function renderBooth() {
  const bar = $('boothBar');
  const on = !!myOwner() && !needsPerson();
  bar.hidden = !on;
  if (!on) return;
  const mine = (state.show.booth || []).filter((p) => p.ownerId === me.ownerId).length;
  $('boothHint').textContent = mine
    ? `От вашей семьи уже ${mine} ${mine === 1 ? 'кадр' : mine < 5 ? 'кадра' : 'кадров'}`
    : 'Кадр попадёт на телевизор и в семейный альбом';
}

async function sendPhoto(file) {
  if (!file || !me) return;
  if (file.size > 12 * 1024 * 1024) { toast('Фотография слишком большая'); return; }
  $('boothHint').textContent = 'Отправляю…';
  try {
    const query = new URLSearchParams({
      name: file.name || 'photo.jpg',
      owner: me.ownerId,
      guest: me.guestId || ''
    });
    const r = await fetch('/api/booth?' + query, { method: 'POST', body: file });
    const data = await r.json();
    if (data.ok) { buzz(20); toast('Фото в альбоме!'); }
    else toast(data.error || 'Не получилось');
  } catch (e) {
    toast('Нет связи — попробуй ещё раз');
  }
  renderBooth();
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

// «Мы вместе» — это тоже ответ: guestId остаётся пустым, но вопрос больше
// не задаём. Поэтому важно отличать «ещё не выбрал» (undefined) от «выбрал
// отвечать за всю семью» (пустая строка).
function pickPerson(guestId) {
  remember({ ...me, guestId: String(guestId || '') });
  joined = false;
  ensureJoined();
  render();
}

function ensureJoined() {
  if (joined || !me || !myOwner() || needsPerson()) return;
  joined = true;
  bus.send('join', { playerId: me.playerId, ownerId: me.ownerId, guestId: me.guestId || '' });
}

// Ответ уходит вместе с playerId: сервер складывает ответы семьи по людям,
// а не затирает предыдущий. Бабушка, ответившая первой, больше не пропадает.
function sendVote(value) {
  if (!me) return;
  bus.send('vote', { ownerId: me.ownerId, playerId: me.playerId, value });
}

// ——— события ———

document.body.addEventListener('click', (e) => {
  const pickBtn = e.target.closest('[data-pick]');
  if (pickBtn) { buzz(); pick(pickBtn.dataset.pick); return; }

  const person = e.target.closest('[data-person]');
  if (person) { buzz(); pickPerson(person.dataset.person); return; }

  if (e.target.closest('[data-back]')) { buzz(); remember(null); joined = false; render(); return; }

  const choice = e.target.closest('[data-choice]');
  if (choice) {
    buzz(18);
    sendVote(Number(choice.dataset.choice));
    toast('Ответ принят!');
    return;
  }

  const joker = e.target.closest('[data-joker]');
  if (joker && !joker.disabled) {
    buzz(25);
    bus.send('joker', { ownerId: me.ownerId, kind: joker.dataset.joker })
      .then((r) => toast(r.ok ? 'Джокер пошёл в дело!' : r.error || 'Не вышло'));
    return;
  }

  const bz = e.target.closest('[data-buzz]');
  if (bz) {
    buzz(35);
    bus.send('buzz', { playerId: me.playerId, ownerId: me.ownerId, rtt });
    return;
  }

  const send = e.target.closest('[data-send]');
  if (!send) return;

  if (send.dataset.send === 'number') {
    const input = $('numIn');
    if (!input || input.value === '') { toast('Впиши число'); return; }
    buzz(18);
    sendVote(input.value);
    toast('Ставка принята!');
    return;
  }

  if (send.dataset.send === 'text') {
    const input = $('textIn');
    const text = input ? input.value.trim() : '';
    if (!text) { toast('Сначала напиши'); return; }
    buzz(18);
    sendVote(text);
    toast('Отправлено!');
  }
});

document.body.addEventListener('change', (e) => {
  const pickGuest = e.target.closest('[data-guest-pick]');
  if (!pickGuest || !pickGuest.value) return;
  buzz(18);
  sendVote(pickGuest.value);
  pickGuest.blur();
  toast('Ответ принят!');
});

$('boothInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  sendPhoto(file);
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
// Заодно снимаем фальстарт, когда его пара секунд истекла.
setInterval(() => {
  renderTimer();
  const b = state && state.runtime && state.runtime.round && state.runtime.round.buzz;
  if (b && (b.falseStart || 0) > Date.now() - 400) render();
}, 250);

ping();
setInterval(ping, 5000);

// Уходя со страницы, отвязываем телефон — иначе список игроков зарастёт.
window.addEventListener('pagehide', () => {
  if (me && navigator.sendBeacon) {
    navigator.sendBeacon('/api/command', new Blob(
      [JSON.stringify({ type: 'leave', payload: { playerId: me.playerId } })],
      { type: 'application/json' }
    ));
  }
});
