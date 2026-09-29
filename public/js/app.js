// Экран телевизора: рисует сцену и слушает команды с пульта.

import * as bus from './bus.js';
import { mountPartyTV, updatePartyTV } from './party-tv.js';
import { rosterPage, pagerHtml } from './roster.js';
import * as sfx from './sfx.js';
import * as confetti from './confetti.js';
import * as music from './music.js';
import { lionSvg, thoughtHtml, pickLine, lionProp } from './lion.js';
import { buildCtx } from './engine/ctx.js';
import { audienceCallHtml } from './engine/participation.js';
import * as timer from './engine/timer.js';
import { loadTypes } from './engine/registry.js';
import * as screens from './screens.js';
import { esc, owners, pointsOf, fmtScore } from './util.js';
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
  panelGuests: document.getElementById('panelGuests'),
  timerRing: document.getElementById('timerRing'),
  roundBar: document.getElementById('roundBar'),
  spotlight: document.getElementById('spotlight'),
  interlude: document.getElementById('interlude'),
  cake: document.getElementById('cake')
};

const PARTY = ['#E63946', '#FFC93C', '#22C1BC', '#FF7BAC', '#4CC96A', '#9B6BFF', '#4A90D9', '#FF8A3D'];

let state = null;
let net = null;
let paintKey = '';
// repeat: null означает «ещё не видели ни одного состояния». Иначе первый же
// повтор вопроса считался бы «старым» и не показывался.
let seen = { fx: 0, award: 0, video: 0, music: 0, phase: '', repeat: null, audience: '' };
let sceneKey = '';
let curtainTimer = 0;
let entranceTimers = [];
function endEntrance() {
  entranceTimers.forEach(clearTimeout);
  entranceTimers = [];
  el.stage.classList.remove('theater-introduction');
  el.interlude.classList.remove('is-on');
}

// ——— декорации ———

function buildSky() {
  let html = '';
  for (let i = 0; i < 46; i++) {
    const size = 0.4 + Math.random() * 0.5;
    const bar = Math.random() < 0.45;
    // Точки держатся по краям сцены. В середине живёт вопрос, и конфетти
    // поверх букв читается не как праздник, а как грязь на экране.
    const side = Math.random() < 0.5 ? 0 : 70;
    const left = side + Math.random() * 30;
    html += `<span class="dot ${bar ? 'is-bar' : ''}" style="left:${left.toFixed(2)}%;
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
  // Внутри кулис (они занимают по 7.5% с каждого края), иначе шарики
  // поднимаются за занавесом и их не видно вовсе.
  const set = [
    { left: '10%', color: '#E63946', deep: '#B02B36', delay: '0s', dur: '26s' },
    { left: '17%', color: '#FFC93C', deep: '#D9A00F', delay: '9s', dur: '31s' },
    { left: '83%', color: '#22C1BC', deep: '#15918D', delay: '4s', dur: '29s' },
    { left: '90%', color: '#FF7BAC', deep: '#D9497F', delay: '15s', dur: '34s' }
  ];
  el.balloons.innerHTML = set.map((b) =>
    `<div class="balloon" style="left:${b.left};animation-delay:${b.delay};animation-duration:${b.dur}">
      ${balloonSvg(b.color, b.deep)}</div>`).join('');
}

// Гирлянда собирается под конкретную ширину: флажки расставлены по точкам
// кривой в пикселях, поэтому после изменения размера её надо пересобрать.
// Слушать window resize мало — при входе в полный экран он стреляет не всегда
// (тем же и лечится канвас конфетти). Пересобираем не чаще раза на кадр:
// иначе перетаскивание окна пересчитывает семьдесят узлов на каждый пиксель.
function watchStageWidth() {
  let width = 0;
  let queued = 0;
  const rebuild = () => {
    queued = 0;
    const w = el.garland.clientWidth;
    if (!w || w === width) return;
    width = w;
    buildGarland();
  };
  const schedule = () => {
    if (queued) return;
    queued = requestAnimationFrame(rebuild);
  };
  width = el.garland.clientWidth;
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(el.garland);
  else window.addEventListener('resize', schedule);
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

// Что сейчас лежит в контейнере сцены: конкретный конкурс или экран показа.
let sceneOwner = '';

// Форматы с mount метят контейнер своими ключами, чтобы не перерисовывать
// видео на каждом кадре. Если при уходе на другой номер эти метки не стереть,
// формат при возврате решит, что рисовать нечего, — и на экране останется
// чужая картинка. Раньше здесь стирались метки двух известных форматов,
// и любой новый ломался молча.
function claimScreen(owner) {
  if (sceneOwner === owner) return;
  sceneOwner = owner;
  for (const key of Object.keys(el.screen.dataset)) delete el.screen.dataset[key];
  el.screen.innerHTML = '';
  paintKey = '';
}

function paint(key, html) {
  if (paintKey === key) return false;
  paintKey = key;
  el.screen.innerHTML = html;
  // Игравший ролик выкинули из DOM — события pause уже не будет, снимаем приглушение сами.
  syncMusicDuck();
  return true;
}

// ——— отрисовка ———

// Между номерами кулисы съезжаются, за ними меняется картинка — и разъезжаются.
function scheduleScene(r, ctx) {
  const key = r.screen === 'show' && ctx.contest ? 'c:' + ctx.contest.id : 's:' + r.screen;
  if (key === sceneKey) {
    if (r.phase !== 'intro' || r.intermission?.open || r.ceremony?.open || r.partyDraw?.open || r.album?.open) endEntrance();
    if (!curtainTimer) paintScene(r, ctx);
    return;
  }
  const first = !sceneKey;
  sceneKey = key;
  endEntrance();
  el.stage.classList.add('is-curtain');
  if (first) paintScene(r, ctx);

  // Название появляется уже за открывающимся занавесом, в затемнённом зале.
  const plate = r.screen === 'show' && r.phase === 'intro' && ctx.contest && state.show.interludes !== false
    ? { top: ctx.contest.subtitle || `Номер ${ctx.contestIndex + 1}`, main: ctx.contest.title }
    : null;
  el.interlude.innerHTML = plate
    ? `<div class="interlude-plate"><div class="top">${esc(plate.top)}</div><div class="main">${esc(plate.main)}</div></div>`
    : '';
  el.interlude.classList.add('cinema-title');
  // Табличка объявляет номер — пусть объявляет и его цвет.
  if (plate && ctx.type && ctx.type.accent) {
    el.interlude.style.setProperty('--accent', ctx.type.accent);
  } else {
    el.interlude.style.removeProperty('--accent');
  }
  clearTimeout(curtainTimer);
  curtainTimer = setTimeout(() => {
    curtainTimer = 0;
    paintScene(state.runtime, currentCtx());
    const live = state.runtime;
    const showEntrance = plate && live.screen === 'show' && live.phase === 'intro' && !live.intermission?.open && !live.ceremony?.open && !live.partyDraw?.open && !live.album?.open;
    if (showEntrance) {
      el.stage.classList.add('theater-introduction');
      sfx.play('drumroll');
      const calm = state.show.director?.motion === 'calm';
      entranceTimers.push(setTimeout(() => el.interlude.classList.add('is-on'), calm ? 100 : 650));
      entranceTimers.push(setTimeout(() => {
        endEntrance();
        document.dispatchEvent(new Event('theater:reveal'));
      }, calm ? 1700 : 4600));
    }
    el.stage.classList.remove('is-curtain');
    if (!showEntrance) document.dispatchEvent(new Event('theater:reveal'));
  }, first ? 500 : 1350);
}

// Цвет номера. Каждый формат объявляет свой accent — на нём и держится всё
// различие между пятнадцатью конкурсами: подсветка купола, полоса на афише,
// кант карточки, табличка между номерами. Раньше accent доезжал только до
// заливки с прозрачностью 0.07 и не был виден ни вблизи, ни с дивана.
// Свойство обязательно снимаем, когда номера нет: иначе цвет прошлого
// конкурса протекает на заставку, таблицу лидеров и финал.
function applyAccent(r, ctx) {
  const accent = r.screen === 'show' && ctx.contest ? ctx.type.accent : '';
  if (accent) {
    document.documentElement.style.setProperty('--accent', accent);
    el.stage.classList.add('has-accent');
  } else {
    document.documentElement.style.removeProperty('--accent');
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
  return JSON.stringify(owners(state)) + '|' + state.runtime.rosterPage;
}

function paintScene(r, ctx) {
  claimScreen(r.screen === 'show' && ctx.contest ? 'c:' + ctx.contest.id : 's:' + r.screen);

  if (r.screen === 'welcome') paint('welcome|' + (net ? net.remoteUrl + '|' + net.playUrl : '') + '|' + ctx.playMode, screens.welcome(state, net));
  else if (r.screen === 'guests') paint('guests|' + JSON.stringify(state.guests.map((g) => g.name + g.avatar + g.teamId + (g.playing === false ? '-' : '+'))) + ownersKey(), screens.guests(state));
  else if (r.screen === 'leaderboard') paint('board|' + ownersKey(), screens.leaderboard(state));
  else if (r.screen === 'finale') paint('finale|' + ownersKey(), screens.finale(state));
  else if (r.screen === 'diploma') paint('diploma|' + ownersKey(), screens.diploma(state));
  else if (r.screen === 'recap') paint('recap|' + ownersKey() + '|' + ((r.stats && r.stats.questions || []).length), screens.recap(state));
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
  // Подиум должен стоять на бортике манежа, а не висеть в воздухе посреди
  // сцены: финал прижимаем к полу арены.
  el.screen.classList.toggle('screen--floor', r.screen === 'finale');
  el.lionWrap.classList.toggle('is-hidden', bare);
  const sidebar = r.screen === 'show' && owners(state).length > 0;
  el.stage.classList.toggle('has-roster', sidebar);
  el.stage.dataset.screen = r.screen;
  el.stage.dataset.phase = r.phase;
  el.scorebar.hidden = !sidebar;
  document.body.classList.toggle('is-rehearsal', !!r.rehearsal);

  timer.update(r);
  document.body.classList.toggle('is-spot', !!(r.spot && r.spot.on));
  updateCake(r);
  applyAccent(r, ctx);
  scheduleScene(r, ctx);
  setProp(propFor(r, ctx));
  renderScorebar();
  renderRoundBar(r, ctx);
  renderPanel();

  // реплика львёнка
  const custom = (r.lionLine || '').trim();
  // Во время вопроса облако прячется (см. tv.css), но реплику, которую
  // ведущий написал Лёве сам, показываем всегда.
  el.lionWrap.classList.toggle('has-line', !!custom);
  if (custom) say(custom);
  else if (r.screen === 'show' && ctx.contest && r.phase === 'intro') say(ctx.contest.lionLine || pickLine('intro', ctx.contestIndex));
  else if (r.screen === 'show' && ctx.contest && ctx.item) {
    say(ctx.type.lion ? ctx.type.lion(ctx) : pickLine(r.phase === 'reveal' ? 'reveal' : 'question', ctx.index));
  } else say(pickLine(r.screen, ctx.contestIndex));
}

function chipAvatarInner(g) {
  return hasAvatar(g.avatar)
    ? avatar(g.avatar)
    : `<span style="display:grid;place-items:center;width:100%;height:100%">${esc(g.emoji || '')}</span>`;
}

function chipAvatar(g) {
  return `<span class="av">${chipAvatarInner(g)}</span>`;
}

// Табло раунда. Пока идёт вопрос — сколько ответило (но не кто что выбрал:
// этого экран и сам не знает до раскрытия). После ответа — кто угадал;
// список берём из журнала начислений, чтобы не считать победителей дважды.
function renderRoundBar(r, ctx) {
  const box = el.roundBar;
  const vote = ctx.type && ctx.type.participation && ctx.type.participation.vote;
  const buzz = ctx.round && ctx.round.buzz;
  const buzzing = !!(buzz && (buzz.open || (buzz.order && buzz.order.length)));
  const live = r.screen === 'show' && ctx.contest && ctx.item
    && (buzzing || (ctx.playMode === 'phones' && vote));
  if (!live) { box.hidden = true; return; }
  box.hidden = false;

  // Жужжалка важнее счётчика: если она открыта, показываем очередь.
  if (buzzing) {
    const order = buzz.order || [];
    if (!order.length) {
      box.innerHTML = '<span class="rb-label">Жми жужжалку!</span>';
      return;
    }
    const first = order[0];
    box.innerHTML = '<span class="rb-label">Кто первый</span>' + order.map((x, i) => {
      const o = ctx.owners.find((y) => y.id === x.ownerId);
      if (!o) return '';
      const gap = i === 0 ? '' : '+' + ((x.at - first.at) / 1000).toFixed(2).replace('.', ',') + ' с';
      return `<span class="rb-place">${i + 1}</span>${dot(o, true)}`
        + `<span class="rb-label">${esc(o.name)}</span>`
        + (gap ? `<span class="rb-count">${gap}</span>` : '');
    }).join('');
    return;
  }

  if (r.phase === 'reveal') {
    const award = (r.awardLog || []).filter((e) => e.roundKey === ctx.roundKey && !e.undone).pop();
    const ids = award ? award.entries.map((e) => e.id) : [];
    const winners = ctx.owners.filter((o) => ids.includes(o.id));
    box.innerHTML = winners.length
      ? '<span class="rb-label">Угадали!</span>' + winners.map((o) => dot(o, true)).join('')
      + `<span class="rb-label">${winners.map((o) => esc(o.name)).join(', ')}</span>`
      : '<span class="rb-label">В этот раз не угадал никто</span>';
    return;
  }

  box.innerHTML = `<span class="rb-label">Ответили <span class="rb-count">${ctx.stats.answered}</span> из ${ctx.stats.total}</span>`
    + ctx.owners.map((o) => dot(o, ctx.hasVote(o.id))).join('');
}

function dot(o, on) {
  return `<span class="rb-dot ${on ? 'is-on' : ''}" style="--c:${esc(o.color || 'var(--ink)')}">${chipAvatarInner(o)}</span>`;
}

let scorebarKey = '';
function renderScorebar() {
  // Подсвечиваем всех, кому только что начислили: их может быть несколько сразу.
  const last = state.runtime.lastAward;
  const hot = new Set(((last && last.entries) || []).map((e) => e.id));
  const ctx = currentCtx();
  const list = rosterPage(state).list;
  const markup = `<div class="roster-heading"><div><span class="roster-kicker">Звёзды представления</span><h2>На арене</h2></div><span class="roster-total">${owners(state).length}<small>${state.show.mode === 'guests' ? 'Гости' : 'Семьи'}</small></span></div><div class="roster-list">` + list.map((g) => `
    <div class="chip ${hot.has(g.id) ? 'is-hot' : ''}" data-guest="${esc(g.id)}" style="--c:${esc(g.color || 'var(--ink)')}">
      ${chipAvatar(g)}
      <span class="chip-name">${esc(g.name)}${ctx.playMode === 'phones' && ctx.hasVote(g.id) ? '<small>Ответили ✓</small>' : ''}</span>
      <span class="pts">${icon('star-fill')}${fmtScore(g.score)}</span>
    </div>`).join('') + '</div><div class="roster-foot" aria-hidden="true"><img src="/img/magic-hat.svg" alt="" width="240" height="200"><span>Каждый ответ —<br>маленькое чудо!</span></div>' + pagerHtml(state);
  // Таймер и ответы других страниц не должны заново запускать появление карточек.
  if (markup !== scorebarKey) { el.scorebar.innerHTML = markup; scorebarKey = markup; }
}

function renderPanel() {
  if (!el.panel.classList.contains('is-open')) return;
  el.panelGuests.innerHTML = owners(state).map((g, i) => `
    <div class="row">
      <span class="who">${i < 9 ? `<kbd>${i + 1}</kbd> ` : ''}${esc(g.name)}</span>
      <button class="btn btn--ghost" data-award="${esc(g.id)}" data-delta="-1">${icon('minus')}</button>
      <span class="pts">${fmtScore(g.score)}</span>
      <button class="btn btn--primary" data-award="${esc(g.id)}" data-delta="1">${icon('plus')}</button>
    </div>`).join('');
}

// ——— отсчёт до торта ———

// Десять секунд гигантскими цифрами, свет гаснет, на нуле — фанфара.
let cakeRaf = 0;

function updateCake(r) {
  const at = r.cake && r.cake.at;
  if (!at) {
    if (cakeRaf) cancelAnimationFrame(cakeRaf);
    cakeRaf = 0;
    el.cake.hidden = true;
    document.body.classList.remove('is-cake');
    return;
  }
  if (cakeRaf) return;

  let last = -1;
  const tick = () => {
    cakeRaf = requestAnimationFrame(tick);
    const left = Math.ceil((at - bus.serverNow()) / 1000);
    if (left > 10) return;

    // После нуля поздравление держится ещё пять секунд: секунда — это
    // мгновение, за которое никто не успеет поднять глаза от торта.
    if (left <= -5) {
      el.cake.hidden = true;
      document.body.classList.remove('is-cake');
      cancelAnimationFrame(cakeRaf);
      cakeRaf = 0;
      return;
    }

    el.cake.hidden = false;
    document.body.classList.add('is-cake');
    if (left === last) return;
    last = left;

    if (left > 0) {
      el.cake.innerHTML = `<div class="cake-num">${left}</div>`;
      sfx.play('beep');
      return;
    }
    if (left === 0) {
      el.cake.innerHTML = '<div class="cake-word">С днём рождения!</div>';
      sfx.play('tada');
      confetti.fountain(200);
      confetti.streamers(30);
      music.dip(5);
    }
  };
  tick();
}

// ——— реакции на события ———

// Что делает каждая кнопка саундборда. Добавить звук — это строка в таблице,
// а не ещё одна ветка в цепочке условий.
const FX = {
  confetti: { sound: 'applause', run: () => confetti.burst(140) },
  drumroll: { sound: 'drumroll', dip: 3 },
  applause: { sound: 'applause' },
  correct: { sound: 'correct', run: () => lionReact('happy') },
  wrong: { sound: 'wrong', run: () => lionReact('sad') },
  tada: { sound: 'tada', dip: 4, run: () => confetti.fountain(160) },

  // Реквизит клоуна.
  slip: { sound: 'slip', run: () => lionReact('sad') },
  trombone: { sound: 'trombone', dip: 2, run: () => lionReact('sad') },
  gong: { sound: 'gong', dip: 2 },
  boing: { sound: 'boing' },
  honk: { sound: 'honk' },
  beep: { sound: 'beep' },
  buzz: { sound: 'buzz' },
  bubbles: { sound: 'sparkle', run: () => confetti.bubbles(30) },
  streamers: { sound: 'whoosh', run: () => confetti.streamers(26) },
  hearts: { sound: 'sparkle', run: () => confetti.hearts(16) }
};

function popPoint(chip, delta) {
  const node = document.createElement('span');
  node.className = 'pop-point';
  node.textContent = (delta > 0 ? '+' : '') + delta;
  if (delta < 0) node.style.color = 'var(--red)';
  chip.appendChild(node);
  setTimeout(() => node.remove(), 1200);
}

// Вопрос крупно поверх сцены на несколько секунд. Не заменяет экран: за
// плашкой остаётся всё, что было, — ответы гостей никуда не делись.
function flashPanel(html, ms, extra) {
  const old = document.querySelector('.repeat-flash');
  if (old) old.remove();
  const node = document.createElement('div');
  node.className = 'repeat-flash ' + (extra || '');
  node.innerHTML = html;
  el.stage.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-on'));
  setTimeout(() => {
    node.classList.remove('is-on');
    setTimeout(() => node.remove(), 600);
  }, ms);
}

function flashQuestion(text) {
  flashPanel(`<div class="repeat-flash-label">Повторяю вопрос</div>
    <div class="repeat-flash-q">${esc(text || '')}</div>`, 4200);
}

function reactions() {
  const r = state.runtime;

  // «Помощь зала»: объявляем крупно и ненадолго, кто взял джокер. Расклад
  // голосов — только на телефонах этой семьи.
  const roundKey = r.contestId + '/' + r.itemId;
  const round = (r.rounds || {})[roundKey];
  const callers = round && round.audience && typeof round.audience === 'object' ? Object.keys(round.audience) : [];
  const audienceKey = roundKey + '|' + callers.join(',');
  if (seen.audience === '') seen.audience = audienceKey;        // запомнили, с чем открылись
  else if (callers.length && seen.audience !== audienceKey) {
    const before = seen.audience.startsWith(roundKey + '|') ? seen.audience.slice(roundKey.length + 1).split(',') : [];
    seen.audience = audienceKey;
    const html = audienceCallHtml(currentCtx(), callers.filter((id) => !before.includes(id)));
    if (html) flashPanel(html, 5000, 'audience-flash');
  } else seen.audience = audienceKey;

  const repeatSeq = (r.repeat && r.repeat.seq) || 0;
  if (seen.repeat === null) seen.repeat = repeatSeq;      // запомнили, с чем открылись
  else if (repeatSeq !== seen.repeat) {
    seen.repeat = repeatSeq;
    flashQuestion(r.repeat.q);
  }

  if (r.fx && r.fx.seq !== seen.fx) {
    seen.fx = r.fx.seq;
    const effect = FX[r.fx.type];
    if (effect) {
      if (effect.sound) sfx.play(effect.sound);
      if (effect.dip) music.dip(effect.dip);
      if (effect.run) effect.run();
    }
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
  if (e.target.closest('button, input, textarea, select')) return;
  if (k === 'ArrowUp' || k === 'ArrowDown') { bus.send('rosterPage', { delta: k === 'ArrowUp' ? -1 : 1 }); e.preventDefault(); return; }
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
  if (k === 's' || k === 'S' || k === 'ы' || k === 'Ы') {
    bus.send('spot', { on: !(state.runtime.spot && state.runtime.spot.on) });
    return;
  }
  if (k === 't' || k === 'T' || k === 'е' || k === 'Е') {
    // Одна клавиша: нет таймера — запускаем минуту, есть — убираем.
    bus.send(state.runtime.timer ? 'timerReset' : 'timerStart', { seconds: 60 });
    return;
  }
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
  mountPartyTV();
  mountSprite();
  mountArtSprite();
  mountAvatarSprite();
  buildSky();
  buildGarland();
  buildBalloons();
  buildLion();
  confetti.init(el.confetti);
  timer.mount(el.timerRing, {
    tick: () => sfx.play('tick'),
    end: () => {
      sfx.play('gong');
      music.dip(2);
      lionReact('sad');
    },
    done: (seq) => bus.send('timerDone', { seq })
  });
  watchCursor();

  el.nudge.innerHTML = icon('sound') + ' Включить звук';

  watchStageWidth();
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', ensureSound);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-roster]');
    if (b) bus.send('rosterPage', { delta: Number(b.dataset.roster) });
  });
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
    net = { remoteUrl: info.remoteUrl || '', playUrl: info.playUrl || '' };
    paintKey = '';
    if (state) render();
  }).catch(() => {});

  bus.onStatus((ok) => document.body.classList.toggle('is-offline', !ok));
  bus.onState((next) => {
    state = next;
    render();
    reactions();
    updatePartyTV(next);
  });
  bus.start('tv');

  setTimeout(() => { el.nudge.hidden = sfx.isReady(); }, 1200);
}

init();
