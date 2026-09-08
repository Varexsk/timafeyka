// Пульт ведущего: листает показ, подсказывает правильные ответы, начисляет баллы.

import * as bus from './bus.js';
import { getType, loadTypes } from './engine/registry.js';
import { buildCtx, activeContests } from './engine/ctx.js';
import { voteInputs } from './engine/participation.js';
import { clock, leftSeconds } from './engine/timer.js';
import { esc, owners, isTeamMode, ownerAvatar, pointsOf } from './util.js';
import { mountSprite, icon } from './icons.js';
import { mountArtSprite } from './art.js';
import { mountAvatarSprite, avatar, hasAvatar } from './avatars.js';

await loadTypes();

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

// ——— таймер ———

// Разметку пересобираем, только когда меняется сам вид полосы: цифра тикает
// четыре раза в секунду, и перерисовывать под пальцем кнопки нельзя.
let timerShape = '';

function timerHtml(t) {
  if (!t) {
    return `<span class="grow">Таймер</span>
      <button class="btn btn--ghost" data-timer="start" data-sec="30">30 с</button>
      <button class="btn btn--primary" data-timer="start" data-sec="60">Минута</button>
      <button class="btn btn--ghost" data-timer="start" data-sec="120">2 мин</button>`;
  }
  const over = leftSeconds(t) <= 0;
  const middle = over ? 'время вышло' : (t.label || (t.running ? 'идёт' : 'пауза'));
  return `
    <span class="t-num">${clock(t)}</span>
    <span class="grow">${esc(middle)}</span>
    ${over
    ? `<button class="btn btn--primary" data-timer="start" data-sec="60">Ещё минуту</button>`
    : `<button class="btn btn--ghost" data-timer="add" data-sec="10">+10 с</button>
       ${t.running
    ? `<button class="btn btn--ghost" data-timer="pause">${icon('pause')}</button>`
    : `<button class="btn btn--primary" data-timer="resume">${icon('play')}</button>`}`}
    <button class="btn btn--ghost" data-timer="reset" title="Убрать таймер">${icon('cross')}</button>`;
}

function renderTimer() {
  const bar = $('timerBar');
  if (!bar || !state) return;
  const t = state.runtime.timer;
  const shape = t ? [t.seq, t.running, leftSeconds(t) <= 0].join('|') : 'none';
  if (shape !== timerShape) {
    timerShape = shape;
    bar.innerHTML = timerHtml(t);
  }
  if (!t) return;
  const left = leftSeconds(t);
  bar.className = 'r-timer' + (t.running && left <= 3 ? ' is-warn' : '');
  const num = bar.querySelector('.t-num');
  if (num) num.textContent = clock(t);
}

// Каждый ответ прилетает обратно с сервера и перерисовывает пульт. Если в этот
// момент ведущий печатает число, поле подменяется под пальцами и цифры
// теряются. Поэтому поле, в котором сейчас работают, оставляем как есть.
function setNowBody(html) {
  const body = $('nowBody');
  if (body.innerHTML === html) return;

  const active = document.activeElement;
  const editing = active && active.dataset && active.dataset.vote ? active.dataset.vote : null;
  const typed = editing ? active.value : null;

  body.innerHTML = html;
  if (!editing) return;

  const again = body.querySelector(`[data-vote="${editing}"]`);
  if (!again) return;
  again.value = typed;
  again.focus();
}

function render() {
  const r = state.runtime;

  // Кнопка музыки на всех пультах должна показывать одно и то же.
  const musicBtn = document.querySelector('[data-music]');
  if (musicBtn) musicBtn.classList.toggle('is-on', musicOn());
  const ctx = ctxNow();

  document.body.classList.toggle('is-rehearsal', !!r.rehearsal);
  renderTimer();

  $('topTitle').textContent = r.screen === 'show' && ctx.contest ? ctx.contest.title : SCREEN_NAMES[r.screen] || 'Показ';
  $('topSub').textContent = r.screen === 'show' && ctx.contest
    ? `${ctx.contest.subtitle || ''} · ${ctx.total ? `вопрос ${ctx.index + 1} из ${ctx.total}` : 'без вопросов'}`
    : ctx.names.title;

  const showPhases = r.screen === 'show';
  $('phaseRow').style.display = showPhases ? '' : 'none';
  $('phaseRow').querySelectorAll('span').forEach((s) => {
    s.classList.toggle('is-on', showPhases && s.dataset.phase === r.phase);
  });

  if (r.screen !== 'show') {
    setNowBody(`<div class="r-note">На телевизоре: <b>${esc(SCREEN_NAMES[r.screen] || r.screen)}</b>.
      Жми «Дальше», чтобы двигаться по программе.</div>`);
  } else if (!ctx.contest) {
    setNowBody('<div class="r-note">Нет включённых конкурсов — включи их в кабинете.</div>');
  } else if (r.phase === 'intro' || !ctx.item) {
    setNowBody(`<div class="r-question">${esc(ctx.contest.title)}</div>
      <div class="r-note">${esc(ctx.contest.rules || '')}</div>
      <div class="r-note">Показываем афишу. «Дальше» — первый вопрос.</div>`);
  } else {
    setNowBody(ctx.type.remote(ctx) + voteInputs(ctx));
  }

  $('btnReveal').innerHTML = r.phase === 'reveal'
    ? icon('eye-off') + ' Скрыть'
    : icon('eye') + ' Ответ';
  $('btnReveal').disabled = r.screen !== 'show' || r.phase === 'intro';

  const dots = $('itemDots');
  if (r.screen === 'show' && ctx.total > 1) {
    dots.innerHTML = ctx.items.map((it, i) => `
      <button data-item="${esc(it.id)}" class="${i === ctx.index ? 'is-on' : i < ctx.index ? 'is-done' : ''}">${i + 1}</button>`).join('');
  } else {
    dots.innerHTML = '';
  }

  document.title = 'Пульт ведущего · ' + ctx.names.title;
  $('sayText').placeholder = `Что скажет ${ctx.names.lion}?`;
  $('sayClear').textContent = `Пусть ${ctx.names.lion} говорит своё`;

  const teamMode = isTeamMode(state);
  $('scoreTitle').textContent = teamMode ? 'Баллы семьям' : 'Баллы гостям';
  $('newGuest').placeholder = teamMode ? 'Название новой семьи' : 'Имя нового гостя';

  // Кнопка показывает, сколько на самом деле стоит верный ответ в этом номере.
  const pts = r.screen === 'show' && ctx.contest ? pointsOf(ctx.contest) : 1;
  const rows = owners(state).map((o) => `
    <div class="g-row">
      ${guestAvatar(o)}
      <span class="nm">${esc(o.name)}</span>
      <button class="btn btn--ghost" data-award="${esc(o.id)}" data-delta="${-pts}">${icon('minus')}</button>
      <span class="pt">${o.score || 0}</span>
      <button class="btn btn--primary" data-award="${esc(o.id)}" data-delta="${pts}">${icon('plus')} ${pts}</button>
    </div>`).join('');

  $('guestRows').innerHTML = (rows || `<div class="r-note">${teamMode ? 'Семей' : 'Гостей'} пока нет — добавь ниже.</div>`) + undoLine();

  $('jumpList').innerHTML = activeContests(state).map((c) => {
    const t = getType(c.type);
    return `<div class="jump-item ${c.id === r.contestId && r.screen === 'show' ? 'is-current' : ''}" data-jump="${esc(c.id)}">
      ${icon(t.icon)}
      <span class="nm">${esc(c.title)}</span>
      <span class="cnt">${(c.items || []).length}</span>
    </div>`;
  }).join('');
}

// Что начислили последним и кнопка «отменить» — чтобы промах правился одним
// касанием, а не подбором минусов.
function undoLine() {
  const log = (state.runtime.awardLog || []).filter((e) => !e.undone);
  const last = log[log.length - 1];
  if (!last) return '';
  const list = owners(state);
  const text = (last.entries || []).map((e) => {
    const o = list.find((x) => x.id === e.id);
    return `${o ? esc(o.name) : '—'} ${e.delta > 0 ? '+' : ''}${e.delta}`;
  }).join(', ');
  return `<div class="r-undo">
      <span>Начислено: ${text}</span>
      <button class="btn btn--ghost" data-undo="1">${icon('refresh')} Отменить</button>
    </div>`;
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
    const tm = e.target.closest('[data-timer]');
    if (tm) {
      buzz();
      const act = tm.dataset.timer;
      const seconds = Number(tm.dataset.sec) || 0;
      if (act === 'start') { bus.send('timerStart', { seconds }); toast('Время пошло!'); }
      else if (act === 'add') { bus.send('timerAdd', { seconds }); toast('+' + seconds + ' с'); }
      else if (act === 'pause') bus.send('timerPause');
      else if (act === 'resume') bus.send('timerResume');
      else if (act === 'reset') { bus.send('timerReset'); toast('Таймер убран'); }
      return;
    }

    const undo = e.target.closest('[data-undo]');
    if (undo) {
      buzz();
      bus.send('undo');
      toast('Начисление отменено');
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
    if (jump) { bus.send('goto', { contestId: jump.dataset.jump, phase: 'intro' }); return; }

    const item = e.target.closest('[data-item]');
    if (item) {
      bus.send('goto', {
        contestId: state.runtime.contestId,
        itemId: item.dataset.item,
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

    const round = e.target.closest('[data-round]');
    if (round) {
      buzz();
      if (round.dataset.round === 'reset') {
        bus.send('resetRound');
        toast('Вопрос переигран');
      } else {
        bus.send('clearVotes');
        toast('Ответы стёрты');
      }
    }
  });

  // Ответы набираются прямо на пульте и сразу видны на телевизоре.
  document.body.addEventListener('input', (e) => {
    const field = e.target.closest('[data-vote]');
    if (!field) return;
    bus.send('vote', { ownerId: field.dataset.vote, value: field.value });
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
// Цифра должна тикать и без новых кадров с сервера.
setInterval(renderTimer, 250);
wire();
bus.start('remote');
