// Пульт ведущего: листает показ, подсказывает правильные ответы, начисляет баллы.

import * as bus from './bus.js';
import { getType } from './types/index.js';
import { buildCtx, activeContests } from './engine/ctx.js';
import { esc, owners, isTeamMode, ownerAvatar } from './util.js';
import { mountSprite, icon } from './icons.js';
import { mountArtSprite } from './art.js';
import { mountAvatarSprite, avatar, hasAvatar } from './avatars.js';

const $ = (id) => document.getElementById(id);
let state = null;

const SCREEN_NAMES = {
  welcome: 'Заставка',
  guests: 'Гости',
  show: 'Конкурс',
  leaderboard: 'Таблица лидеров',
  finale: 'Финал',
  diploma: 'Диплом'
};

const QUICK = [
  { fx: 'confetti', ic: 'confetti', label: 'Конфетти' },
  { fx: 'drumroll', ic: 'drum', label: 'Дробь' },
  { fx: 'applause', ic: 'applause', label: 'Овации' },
  { music: true, ic: 'music', label: 'Музыка' },
  { screen: 'welcome', ic: 'tent', label: 'Заставка' },
  { screen: 'guests', ic: 'users', label: 'Гости' },
  { screen: 'leaderboard', ic: 'trophy', label: 'Лидеры' }
];

function ctxNow() {
  return buildCtx(state);
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-on'), 1100);
}

function buzz() {
  if (navigator.vibrate) navigator.vibrate(12);
}

function guestAvatar(g) {
  const inner = hasAvatar(g.avatar)
    ? avatar(g.avatar)
    : `<span style="display:grid;place-items:center;width:100%;height:100%">${esc(g.emoji || '')}</span>`;
  return `<span class="av" style="--c:${esc(g.color || 'var(--ink)')}">${inner}</span>`;
}

// Ключ ставок текущего вопроса — по нему сервер хранит числа семей.
function betKeyNow() {
  const ctx = ctxNow();
  return ctx.contest && ctx.item ? ctx.contest.id + '/' + ctx.item.id : '';
}

function render() {
  const r = state.runtime;

  // Кнопка музыки на всех пультах должна показывать одно и то же.
  const musicBtn = document.querySelector('[data-music]');
  if (musicBtn) musicBtn.classList.toggle('is-on', musicOn());
  const ctx = ctxNow();

  document.body.classList.toggle('is-rehearsal', !!r.rehearsal);

  $('topTitle').textContent = r.screen === 'show' && ctx.contest ? ctx.contest.title : SCREEN_NAMES[r.screen] || 'Показ';
  $('topSub').textContent = r.screen === 'show' && ctx.contest
    ? `${ctx.contest.subtitle || ''} · ${ctx.total ? `вопрос ${r.itemIndex + 1} из ${ctx.total}` : 'без вопросов'}`
    : ctx.names.title;

  const showPhases = r.screen === 'show';
  $('phaseRow').style.display = showPhases ? '' : 'none';
  $('phaseRow').querySelectorAll('span').forEach((s) => {
    s.classList.toggle('is-on', showPhases && s.dataset.phase === r.phase);
  });

  const body = $('nowBody');
  if (r.screen !== 'show') {
    body.innerHTML = `<div class="r-note">На телевизоре: <b>${esc(SCREEN_NAMES[r.screen] || r.screen)}</b>.
      Жми «Дальше», чтобы двигаться по программе.</div>`;
  } else if (!ctx.contest) {
    body.innerHTML = '<div class="r-note">Нет включённых конкурсов — включи их в кабинете.</div>';
  } else if (r.phase === 'intro' || !ctx.item) {
    body.innerHTML = `<div class="r-question">${esc(ctx.contest.title)}</div>
      <div class="r-note">${esc(ctx.contest.rules || '')}</div>
      <div class="r-note">Показываем афишу. «Дальше» — первый вопрос.</div>`;
  } else {
    body.innerHTML = ctx.type.remote(ctx);
  }

  $('btnReveal').innerHTML = r.phase === 'reveal'
    ? icon('eye-off') + ' Скрыть'
    : icon('eye') + ' Ответ';
  $('btnReveal').disabled = r.screen !== 'show' || r.phase === 'intro';

  const dots = $('itemDots');
  if (r.screen === 'show' && ctx.total > 1) {
    dots.innerHTML = Array.from({ length: ctx.total }, (_, i) => `
      <button data-item="${i}" class="${i === r.itemIndex ? 'is-on' : i < r.itemIndex ? 'is-done' : ''}">${i + 1}</button>`).join('');
  } else {
    dots.innerHTML = '';
  }

  document.title = 'Пульт ведущего · ' + ctx.names.title;
  $('sayText').placeholder = `Что скажет ${ctx.names.lion}?`;
  $('sayClear').textContent = `Пусть ${ctx.names.lion} говорит своё`;

  const teamMode = isTeamMode(state);
  $('scoreTitle').textContent = teamMode ? 'Баллы семьям' : 'Баллы гостям';
  $('newGuest').placeholder = teamMode ? 'Название новой семьи' : 'Имя нового гостя';
  $('guestRows').innerHTML = owners(state).map((o) => `
    <div class="g-row">
      ${guestAvatar(o)}
      <span class="nm">${esc(o.name)}</span>
      <button class="btn btn--ghost" data-award="${esc(o.id)}" data-delta="-1">${icon('minus')}</button>
      <span class="pt">${o.score || 0}</span>
      <button class="btn btn--primary" data-award="${esc(o.id)}" data-delta="1">${icon('plus')} 1</button>
    </div>`).join('') || `<div class="r-note">${teamMode ? 'Семей' : 'Гостей'} пока нет — добавь ниже.</div>`;

  $('jumpList').innerHTML = activeContests(state).map((c, i) => {
    const t = getType(c.type);
    return `<div class="jump-item ${i === r.contestIndex && r.screen === 'show' ? 'is-current' : ''}" data-jump="${i}">
      ${icon(t.icon)}
      <span class="nm">${esc(c.title)}</span>
      <span class="cnt">${(c.items || []).length}</span>
    </div>`;
  }).join('');
}

function musicOn() {
  return !!(state && state.runtime.music && state.runtime.music.on);
}

function attrFor(q) {
  if (q.fx) return 'data-fx="' + q.fx + '"';
  if (q.music) return 'data-music="1"';
  return 'data-screen="' + q.screen + '"';
}

function wire() {
  $('topLogo').innerHTML = icon('hat');
  $('quickBox').innerHTML = QUICK.map((q) => `
    <button class="btn btn--ghost${q.music && musicOn() ? ' is-on' : ''}" ${attrFor(q)}>
      ${icon(q.ic)}<span>${q.label}</span>
    </button>`).join('');

  $('btnNext').innerHTML = 'Дальше ' + icon('arrow-right');
  $('btnPrev').innerHTML = icon('arrow-left') + ' Назад';

  $('btnNext').addEventListener('click', () => { buzz(); bus.send('next'); });
  $('btnPrev').addEventListener('click', () => { buzz(); bus.send('prev'); });
  $('btnReveal').addEventListener('click', () => {
    buzz();
    bus.send('reveal', { on: state.runtime.phase !== 'reveal' });
  });

  document.body.addEventListener('click', (e) => {
    const award = e.target.closest('[data-award]');
    if (award) {
      buzz();
      const delta = Number(award.dataset.delta);
      bus.send('award', { id: award.dataset.award, delta });
      toast(delta > 0 ? 'Плюс балл!' : 'Минус балл');
      return;
    }
    const music = e.target.closest('[data-music]');
    if (music) {
      const next = !musicOn();
      bus.send('music', { on: next });
      toast(next ? 'Музыка играет' : 'Музыка выключена');
      return;
    }

    const fx = e.target.closest('[data-fx]');
    if (fx) { bus.send('fx', { type: fx.dataset.fx }); toast('Поехали!'); return; }

    const screen = e.target.closest('[data-screen]');
    if (screen) { bus.send('goScreen', { screen: screen.dataset.screen }); return; }

    const jump = e.target.closest('[data-jump]');
    if (jump) { bus.send('goto', { contestIndex: Number(jump.dataset.jump), itemIndex: 0, phase: 'intro' }); return; }

    const item = e.target.closest('[data-item]');
    if (item) {
      bus.send('goto', {
        contestIndex: state.runtime.contestIndex,
        itemIndex: Number(item.dataset.item),
        phase: 'question'
      });
      return;
    }

    const media = e.target.closest('[data-media]');
    if (media) {
      const ctx = ctxNow();
      bus.send('video', { action: media.dataset.media, at: (ctx.item && ctx.item.at) || 0 });
      return;
    }

    const clear = e.target.closest('[data-bets="clear"]');
    if (clear) { bus.send('clearBets', { key: betKeyNow() }); toast('Ставки стёрты'); return; }

    const win = e.target.closest('[data-award-win]');
    if (win) {
      buzz();
      bus.send('award', { id: win.dataset.awardWin, delta: 1 });
      toast('Балл ближайшему!');
    }
  });

  // Ставки набираются прямо на пульте и сразу видны на телевизоре.
  document.body.addEventListener('input', (e) => {
    const field = e.target.closest('[data-bet]');
    if (!field) return;
    bus.send('bet', { key: betKeyNow(), ownerId: field.dataset.bet, value: field.value });
  });

  $('addGuest').addEventListener('click', () => {
    const input = $('newGuest');
    const name = input.value.trim();
    if (!name) return;
    bus.send(isTeamMode(state) ? 'addTeam' : 'addGuest', { name });
    input.value = '';
    toast(isTeamMode(state) ? 'Семья на арене!' : 'Гость на арене!');
  });
  $('newGuest').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('addGuest').click(); });

  $('sayBtn').addEventListener('click', () => {
    bus.send('lionSay', { text: $('sayText').value });
    toast(`${ctxNow().names.lion} сказал!`);
  });
  $('sayText').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('sayBtn').click(); });
  $('sayClear').addEventListener('click', () => { bus.send('lionSay', { text: '' }); $('sayText').value = ''; });

  $('toFinale').addEventListener('click', () => {
    bus.send('goScreen', { screen: 'finale' });
    bus.send('fx', { type: 'tada' });
  });
  $('toDiploma').addEventListener('click', () => bus.send('goScreen', { screen: 'diploma' }));

  $('startRehearsal').addEventListener('click', () => {
    bus.send('rehearsal', { on: true });
    toast('Репетиция началась');
  });
  $('stopRehearsal').addEventListener('click', () => {
    bus.send('rehearsal', { on: false });
    toast('Всё вернулось назад');
  });
}

mountSprite();
mountArtSprite();
mountAvatarSprite();
bus.onStatus((ok) => document.body.classList.toggle('is-offline', !ok));
bus.onState((next) => { state = next; render(); });
wire();
bus.start();
