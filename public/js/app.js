// Экран телевизора: рисует сцену и слушает команды с пульта.

import * as bus from './bus.js';
import * as sfx from './sfx.js';
import * as confetti from './confetti.js';
import * as music from './music.js';
import { lionSvg, thoughtHtml, pickLine, lionProp } from './lion.js';
import { buildCtx } from './engine/ctx.js';
import { loadTypes } from './engine/registry.js';
import * as screens from './screens.js';
import { esc, owners, pointsOf } from './util.js';
import { mountSprite, icon } from './icons.js';
import { mountArtSprite } from './art.js';
import { mountAvatarSprite, avatar, hasAvatar } from './avatars.js';

// Форматы конкурсов подгружаются до первого кадра — сцену рисуют они.
await loadTypes();

const el = {
  stage: document.getElementById('stage'),
  sky: document.getElementById('sky'),
  garland: document.getElementById('garland'),
  balloons: document.getElementById('balloons'),
  screen: document.getElementById('screen'),
  lionWrap: document.getElementById('lionWrap'),
  scorebar: document.getElementById('scorebar'),
  confetti: document.getElementById('confetti'),
  nudge: document.getElementById('soundNudge'),
  panel: document.getElementById('tvPanel'),
  panelGuests: document.getElementById('panelGuests')
};

const PARTY = ['#E63946', '#FFC93C', '#22C1BC', '#FF7BAC', '#4CC96A', '#9B6BFF', '#4A90D9', '#FF8A3D'];

let state = null;
let net = null;
let paintKey = '';
let seen = { fx: 0, award: 0, video: 0, music: 0, phase: '' };
let sceneKey = '';
let curtainTimer = 0;

// ——— декорации ———

function buildSky() {
  let html = '';
  for (let i = 0; i < 46; i++) {
    const size = 0.4 + Math.random() * 0.5;
    const bar = Math.random() < 0.45;
    html += `<span class="dot ${bar ? 'is-bar' : ''}" style="left:${(Math.random() * 100).toFixed(2)}%;
      top:${(Math.random() * 88).toFixed(2)}%;width:${(bar ? size * 0.6 : size).toFixed(2)}rem;
      height:${(bar ? size * 1.6 : size).toFixed(2)}rem;
      background:${PARTY[i % PARTY.length]};
      transform:rotate(${Math.round(Math.random() * 90)}deg);
      animation-delay:${(Math.random() * 7).toFixed(2)}s"></span>`;
  }
  el.sky.innerHTML = html;
}

function buildGarland() {
  const w = el.garland.clientWidth || window.innerWidth;
  const h = el.garland.clientHeight || 110;
  const sag = h * 0.5;
  const d = `M0 4 Q ${w / 4} ${sag} ${w / 2} ${sag * 0.6} T ${w} 4`;
  el.garland.innerHTML = `<svg width="${w}" height="${h}" style="position:absolute;inset:0">
      <path class="rope" id="ropePath" d="${d}"/></svg>`;
  const path = el.garland.querySelector('#ropePath');
  const len = path.getTotalLength();
  let out = '';
  const count = Math.max(16, Math.round(w / 78));
  for (let i = 0; i <= count; i++) {
    const p = path.getPointAtLength((i / count) * len);
    const color = PARTY[i % PARTY.length];
    out += `<span class="flag" style="left:${p.x}px;top:${p.y}px;background:${color};
      animation-delay:${(i * 0.11).toFixed(2)}s"></span>`;
  }
  // второй ряд — лампочки чуть выше флажков
  for (let i = 0; i <= count; i++) {
    const p = path.getPointAtLength((i / count) * len);
    const color = PARTY[(i + 3) % PARTY.length];
    out += `<span class="bulb" style="left:${p.x}px;top:${p.y - 1.5}px;
      background:radial-gradient(circle at 35% 30%, #fff, ${color});
      box-shadow:0 0 0.6rem ${color};animation-delay:${(i * 0.14).toFixed(2)}s"></span>`;
  }
  el.garland.insertAdjacentHTML('beforeend', out);
}

function balloonSvg(color, deep) {
  return `<svg viewBox="0 0 60 96" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 2c14 0 24 11 24 25 0 15-11 27-24 27S6 42 6 27C6 13 16 2 30 2Z" fill="${color}"/>
    <path d="M18 18c2-6 6-9 11-10" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".55"/>
    <path d="m30 54 5 8H25z" fill="${deep}"/>
    <path d="M30 62c0 10-9 9-9 18" stroke="#3A2350" stroke-width="2" fill="none" stroke-linecap="round" opacity=".45"/>
  </svg>`;
}

function buildBalloons() {
  const set = [
    { left: '3%', color: '#E63946', deep: '#B02B36', delay: '0s', dur: '26s' },
    { left: '12%', color: '#FFC93C', deep: '#D9A00F', delay: '9s', dur: '31s' },
    { left: '88%', color: '#22C1BC', deep: '#15918D', delay: '4s', dur: '29s' },
    { left: '95%', color: '#FF7BAC', deep: '#D9497F', delay: '15s', dur: '34s' }
  ];
  el.balloons.innerHTML = set.map((b) =>
    `<div class="balloon" style="left:${b.left};animation-delay:${b.delay};animation-duration:${b.dur}">
      ${balloonSvg(b.color, b.deep)}</div>`).join('');
}

function buildLion() {
  el.lionWrap.innerHTML = thoughtHtml('') + lionSvg();
}

function say(text) {
  const node = el.lionWrap.querySelector('.thought .text');
  if (node && node.textContent !== text) node.textContent = text;
}

function lionReact(kind) {
  el.lionWrap.classList.remove('is-happy', 'is-sad');
  void el.lionWrap.offsetWidth;
  if (kind) el.lionWrap.classList.add(kind === 'happy' ? 'is-happy' : 'is-sad');
}

// ——— вспомогательное ———

function currentCtx() {
  return buildCtx(state);
}

function paint(key, html) {
  if (paintKey === key) return false;
  paintKey = key;
  delete el.screen.dataset.vkey;
  delete el.screen.dataset.akey;
  el.screen.innerHTML = html;
  // Игравший ролик выкинули из DOM — события pause уже не будет, снимаем приглушение сами.
  syncMusicDuck();
  return true;
}

// ——— отрисовка ———

// Между номерами кулисы съезжаются, за ними меняется картинка — и разъезжаются.
function scheduleScene(r, ctx) {
  const key = r.screen === 'show' && ctx.contest ? 'c:' + ctx.contest.id : 's:' + r.screen;
  if (key === sceneKey) { paintScene(r, ctx); return; }
  const first = !sceneKey;
  sceneKey = key;
  if (first) { paintScene(r, ctx); return; }
  el.stage.classList.add('is-curtain');
  clearTimeout(curtainTimer);
  curtainTimer = setTimeout(() => {
    paintScene(state.runtime, currentCtx());
    el.stage.classList.remove('is-curtain');
  }, 460);
}

function applyAccent(r, ctx) {
  const accent = r.screen === 'show' && ctx.contest ? ctx.type.accent : '';
  if (accent) {
    document.documentElement.style.setProperty('--accent', accent);
    el.stage.classList.add('has-accent');
  } else {
    el.stage.classList.remove('has-accent');
  }
}

// Реквизит в поднятой лапе Лёвы. Что именно он держит на своём номере —
// решает сам формат конкурса (поле prop), а не список условий здесь.
function propFor(r, ctx) {
  if (r.screen === 'show' && ctx.contest) {
    const p = (ctx.type && ctx.type.prop) || {};
    if (r.phase === 'intro') return p.intro === undefined ? 'mic' : p.intro;
    if (r.phase === 'reveal') return p.reveal === undefined ? 'star' : p.reveal;
    return p.question === undefined ? '' : p.question;
  }
  if (r.screen === 'welcome' || r.screen === 'guests') return 'mic';
  return 'star';
}

function setProp(name) {
  const g = el.lionWrap.querySelector('.lion-prop');
  if (g && g.dataset.prop !== name) {
    g.dataset.prop = name;
    g.innerHTML = lionProp(name);
  }
}

function ownersKey() {
  return JSON.stringify(owners(state).map((o) => o.name + ':' + (o.score || 0)));
}

function paintScene(r, ctx) {
  if (r.screen === 'welcome') paint('welcome|' + (net ? net.url : ''), screens.welcome(state, net));
  else if (r.screen === 'guests') paint('guests|' + JSON.stringify(state.guests.map((g) => g.name + g.avatar + g.teamId)) + ownersKey(), screens.guests(state));
  else if (r.screen === 'leaderboard') paint('board|' + ownersKey(), screens.leaderboard(state));
  else if (r.screen === 'finale') paint('finale|' + ownersKey(), screens.finale(state));
  else if (r.screen === 'diploma') paint('diploma|' + ownersKey(), screens.diploma(state));
  else if (!ctx.contest) paint('empty', '<div class="hint">Ни одного включённого конкурса — добавь их в кабинете</div>');
  else if (r.phase === 'intro' || !ctx.item) paint('intro|' + ctx.contest.id, screens.intro(ctx.contest));
  else {
    const type = ctx.type;
    if (type.mount) {
      paintKey = 'mount|' + ctx.contest.id + '|' + r.itemId + '|' + r.phase;
      type.mount(el.screen, ctx);
    } else {
      // Пришёл новый ответ — сцену надо перерисовать. Раньше здесь было имя
      // формата «ставки»: только он умел показывать ответы участников.
      const answers = JSON.stringify((ctx.round && ctx.round.votes) || null);
      paint(['q', ctx.contest.id, r.itemId, r.phase, JSON.stringify(ctx.item), answers].join('|'), type.stage(ctx));
    }
  }
}

function render() {
  if (!state) return;
  const r = state.runtime;
  const ctx = currentCtx();
  const bare = r.screen === 'finale' || r.screen === 'diploma';

  // Название цирка задаётся в кабинете — вкладка браузера должна его повторять.
  if (document.title !== ctx.names.title) document.title = ctx.names.title;

  el.screen.classList.toggle('screen--wide', bare);
  el.lionWrap.classList.toggle('is-hidden', bare);
  el.scorebar.style.display = ['welcome', 'finale', 'diploma', 'leaderboard'].includes(r.screen) ? 'none' : '';
  document.body.classList.toggle('is-rehearsal', !!r.rehearsal);

  applyAccent(r, ctx);
  scheduleScene(r, ctx);
  setProp(propFor(r, ctx));
  renderScorebar();
  renderPanel();

  // реплика львёнка
  const custom = (r.lionLine || '').trim();
  if (custom) say(custom);
  else if (r.screen === 'show' && ctx.contest && r.phase === 'intro') say(ctx.contest.lionLine || pickLine('intro', ctx.contestIndex));
  else if (r.screen === 'show' && ctx.contest && ctx.item) {
    say(ctx.type.lion ? ctx.type.lion(ctx) : pickLine(r.phase === 'reveal' ? 'reveal' : 'question', ctx.index));
  } else say(pickLine(r.screen === 'diploma' ? 'finale' : r.screen, ctx.contestIndex));
}

function chipAvatar(g) {
  const inner = hasAvatar(g.avatar)
    ? avatar(g.avatar)
    : `<span style="display:grid;place-items:center;width:100%;height:100%">${esc(g.emoji || '')}</span>`;
  return `<span class="av">${inner}</span>`;
}

function renderScorebar() {
  // Подсвечиваем всех, кому только что начислили: их может быть несколько сразу.
  const last = state.runtime.lastAward;
  const hot = new Set(((last && last.entries) || []).map((e) => e.id));
  el.scorebar.innerHTML = owners(state).map((g) => `
    <div class="chip ${hot.has(g.id) ? 'is-hot' : ''}" data-guest="${esc(g.id)}" style="--c:${esc(g.color || 'var(--ink)')}">
      ${chipAvatar(g)}
      <span>${esc(g.name)}</span>
      <span class="pts">${g.score || 0}</span>
    </div>`).join('');
}

function renderPanel() {
  if (!el.panel.classList.contains('is-open')) return;
  el.panelGuests.innerHTML = owners(state).map((g, i) => `
    <div class="row">
      <span class="who">${i < 9 ? `<kbd>${i + 1}</kbd> ` : ''}${esc(g.name)}</span>
      <button class="btn btn--ghost" data-award="${esc(g.id)}" data-delta="-1">${icon('minus')}</button>
      <span class="pts">${g.score || 0}</span>
      <button class="btn btn--primary" data-award="${esc(g.id)}" data-delta="1">${icon('plus')}</button>
    </div>`).join('');
}

// ——— реакции на события ———

function popPoint(chip, delta) {
  const node = document.createElement('span');
  node.className = 'pop-point';
  node.textContent = (delta > 0 ? '+' : '') + delta;
  if (delta < 0) node.style.color = 'var(--red)';
  chip.appendChild(node);
  setTimeout(() => node.remove(), 1200);
}

function reactions() {
  const r = state.runtime;

  if (r.fx && r.fx.seq !== seen.fx) {
    seen.fx = r.fx.seq;
    const type = r.fx.type;
    if (type === 'confetti') { confetti.burst(140); sfx.play('applause'); }
    else if (type === 'drumroll') { sfx.play('drumroll'); music.dip(3); }
    else if (type === 'applause') sfx.play('applause');
    else if (type === 'correct') { sfx.play('correct'); lionReact('happy'); }
    else if (type === 'wrong') { sfx.play('wrong'); lionReact('sad'); }
    else if (type === 'tada') { sfx.play('tada'); confetti.fountain(160); music.dip(4); }
  }

  if (r.music && r.music.seq !== seen.music) {
    seen.music = r.music.seq;
    music.setOn(r.music.on);
  }

  if (r.lastAward && r.lastAward.seq !== seen.award) {
    seen.award = r.lastAward.seq;
    const entries = r.lastAward.entries || [];
    const plus = entries.some((e) => e.delta > 0);
    sfx.play(plus ? 'point' : 'wrong');
    for (const e of entries) {
      const chip = el.scorebar.querySelector(`[data-guest="${e.id}"]`);
      if (!chip) continue;
      popPoint(chip, e.delta);
      if (e.delta > 0) {
        const box = chip.getBoundingClientRect();
        confetti.sparkleAt(box.left + box.width / 2, box.top + box.height / 2, 22);
      }
    }
    if (plus) lionReact('happy');
  }

  const phaseKey = r.screen + '|' + r.contestId + '|' + r.itemId + '|' + r.phase;
  if (phaseKey !== seen.phase) {
    const prev = seen.phase;
    seen.phase = phaseKey;
    if (prev) {
      if (r.screen === 'finale') { sfx.play('tada'); confetti.fountain(180); music.dip(4); }
      else if (r.screen === 'show' && r.phase === 'reveal') { sfx.play('correct'); lionReact('happy'); }
      else if (r.screen === 'show' && r.phase === 'intro') sfx.play('whoosh');
      else sfx.play('click');
    }
  }

  if (r.video && r.video.seq !== seen.video) {
    seen.video = r.video.seq;
    applyMedia(r.video);
  }
}

function applyMedia(cmd) {
  const media = el.screen.querySelector('video, audio');
  if (!media) return;
  const at = Number(cmd.at) || 0;
  if (cmd.action === 'play') { media._stopAt = 0; media.play().catch(() => {}); }
  else if (cmd.action === 'pause') media.pause();
  else if (cmd.action === 'back') media.currentTime = Math.max(0, media.currentTime - 2);
  else if (cmd.action === 'fwd') media.currentTime = media.currentTime + 2;
  else if (cmd.action === 'mark') { media.pause(); media.currentTime = at; }
  else if (cmd.action === 'restart') { media.currentTime = 0; media.play().catch(() => {}); }
}

// Пока на экране играет свой ролик или трек, фоновый марш уходит вниз.
let mediaDucked = false;

function syncMusicDuck() {
  const list = Array.from(el.screen.querySelectorAll('video, audio'));
  const active = list.some((m) => !m.paused && !m.ended);
  if (active === mediaDucked) return;
  mediaDucked = active;
  music.duck(active);
}

// ——— управление с клавиатуры ———

function award(id, delta) { bus.send('award', { id, delta }); }

// Сколько стоит верный ответ в текущем номере. Вне конкурса — просто балл.
function pointsNow() {
  const ctx = currentCtx();
  return state.runtime.screen === 'show' && ctx.contest ? pointsOf(ctx.contest) : 1;
}

function onKey(e) {
  ensureSound();
  const k = e.key;
  if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter') { bus.send('next'); e.preventDefault(); return; }
  if (k === 'ArrowLeft' || k === 'PageUp') { bus.send('prev'); e.preventDefault(); return; }
  if (k === 'f' || k === 'F' || k === 'а' || k === 'А') { toggleFullscreen(); return; }
  if (k === 'h' || k === 'H' || k === 'р' || k === 'Р') { el.panel.classList.toggle('is-open'); renderPanel(); return; }
  if (k === 'r' || k === 'R' || k === 'к' || k === 'К') { bus.send('reveal', { on: state.runtime.phase !== 'reveal' }); return; }
  if (k === 'l' || k === 'L' || k === 'д' || k === 'Д') { bus.send('goScreen', { screen: 'leaderboard' }); return; }
  if (k === 'c' || k === 'C' || k === 'с' || k === 'С') { bus.send('fx', { type: 'confetti' }); return; }
  if (k === 'd' || k === 'D' || k === 'в' || k === 'В') { bus.send('fx', { type: 'drumroll' }); return; }
  if (k === 'm' || k === 'M' || k === 'ь' || k === 'Ь') { bus.send('music', { on: !(state.runtime.music && state.runtime.music.on) }); return; }
  if (k === 'z' || k === 'Z' || k === 'я' || k === 'Я') { bus.send('undo'); return; }
  if (/^[1-9]$/.test(k)) {
    const o = owners(state)[Number(k) - 1];
    if (o) award(o.id, pointsNow());
    return;
  }
  if (/^[!@#$%^&*(]$/.test(k)) {
    const idx = ')!@#$%^&*('.indexOf(k) - 1;
    const o = owners(state)[idx];
    if (o) award(o.id, -pointsNow());
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

// ——— звук ———

function ensureSound() {
  if (sfx.isReady()) { el.nudge.hidden = true; return; }
  sfx.unlock();
  el.nudge.hidden = sfx.isReady();
  // Команда музыки могла прийти ещё до разрешения звука — включаем сейчас.
  if (sfx.isReady() && state && state.runtime.music && state.runtime.music.on) music.setOn(true);
}

// ——— курсор ———

let cursorTimer = 0;
function watchCursor() {
  document.addEventListener('mousemove', () => {
    document.body.style.cursor = '';
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => { document.body.style.cursor = 'none'; }, 3000);
  });
  cursorTimer = setTimeout(() => { document.body.style.cursor = 'none'; }, 3000);
}

// ——— старт ———

function init() {
  mountSprite();
  mountArtSprite();
  mountAvatarSprite();
  buildSky();
  buildGarland();
  buildBalloons();
  buildLion();
  confetti.init(el.confetti);
  watchCursor();

  el.nudge.innerHTML = icon('sound') + ' Включить звук';

  window.addEventListener('resize', () => { buildGarland(); });
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', ensureSound);
  // Ловим в фазе перехвата: элементы вопроса пересоздаются на каждом рендере.
  document.addEventListener('play', syncMusicDuck, true);
  document.addEventListener('pause', syncMusicDuck, true);
  document.addEventListener('ended', syncMusicDuck, true);
  el.nudge.addEventListener('click', ensureSound);
  el.panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-award]');
    if (b) award(b.dataset.award, Number(b.dataset.delta));
  });

  fetch('/api/media').then((r) => r.json()).then((d) => {
    sfx.useCustomSounds(d.files);
    music.useMusicFiles(d.files);
  }).catch(() => {});

  fetch('/api/net').then((r) => r.json()).then((info) => {
    const host = info.addresses && info.addresses[0];
    net = { url: host ? `http://${host}:${info.port}/remote` : '' };
    paintKey = '';
    if (state) render();
  }).catch(() => {});

  bus.onStatus((ok) => document.body.classList.toggle('is-offline', !ok));
  bus.onState((next) => {
    state = next;
    render();
    reactions();
  });
  bus.start('tv');

  setTimeout(() => { el.nudge.hidden = sfx.isReady(); }, 1200);
}

init();
