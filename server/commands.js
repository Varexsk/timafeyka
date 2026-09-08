'use strict';

const { store, clone } = require('./store');
const types = require('./types');

// Двенадцать зверей-артистов из public/js/avatars.js — раздаются гостям по кругу.
const AVATARS = ['elephant', 'bear', 'panda', 'fox', 'tiger', 'zebra',
  'monkey', 'seal', 'giraffe', 'poodle', 'raccoon', 'parrot'];
const COLORS = ['#E63946', '#9B6BFF', '#4A90D9', '#22C1BC', '#4CC96A', '#FF8A3D', '#FF7BAC', '#FFC93C'];

const SCREENS = ['welcome', 'guests', 'show', 'leaderboard', 'finale', 'diploma'];

function activeContests() {
  return (store.show.contests || []).filter((c) => c.enabled !== false);
}

// Где мы сейчас — хранится id конкурса и id вопроса, а не их номера.
// По номерам было хрупко: стоило выключить конкурс посреди показа, и
// ведущего молча переносило в другое место программы.
function currentContest() {
  return activeContests().find((c) => c.id === store.runtime.contestId) || null;
}

function contestPos() {
  return activeContests().findIndex((c) => c.id === store.runtime.contestId);
}

function itemPos(contest) {
  return itemsOf(contest).findIndex((it) => it.id === store.runtime.itemId);
}

// Встаём на конкретный вопрос конкретного конкурса.
function setPos(contest, itemIndex, phase) {
  const r = store.runtime;
  r.contestId = contest ? contest.id : '';
  const it = itemsOf(contest)[itemIndex];
  r.itemId = it ? it.id : '';
  r.phase = phase;
}

function itemsOf(contest) {
  return (contest && contest.items) || [];
}

function newId(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8);
}

// Очки может получать семья или отдельный гость — ищем и там, и там.
function findOwner(id) {
  if (!id) return null;
  return store.guests.teams.find((t) => t.id === id)
    || store.guests.list.find((g) => g.id === id)
    || null;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ——— навигация по показу ———

function goContest(i, atEnd) {
  const list = activeContests();
  const r = store.runtime;
  if (i < 0) { r.screen = 'guests'; return; }
  if (i >= list.length) { r.screen = 'leaderboard'; return; }
  r.screen = 'show';
  const contest = list[i];
  const items = itemsOf(contest);
  if (atEnd) {
    setPos(contest, Math.max(0, items.length - 1), items.length ? 'reveal' : 'intro');
  } else {
    setPos(contest, 0, 'intro');
  }
}

function next() {
  const r = store.runtime;
  if (r.screen === 'welcome') { r.screen = 'guests'; return; }
  if (r.screen === 'guests') { goContest(0, false); return; }
  if (r.screen === 'leaderboard') { r.screen = 'finale'; return; }
  if (r.screen === 'finale') { r.screen = 'diploma'; return; }
  if (r.screen === 'diploma') return;

  const contest = currentContest();
  if (!contest) { r.screen = 'leaderboard'; return; }
  const items = itemsOf(contest);
  const at = itemPos(contest);

  if (r.phase === 'intro') {
    if (!items.length) { goContest(contestPos() + 1, false); return; }
    setPos(contest, 0, 'question');
    return;
  }
  if (r.phase === 'question') { r.phase = 'reveal'; return; }
  if (at + 1 < items.length) {
    setPos(contest, at + 1, 'question');
    return;
  }
  goContest(contestPos() + 1, false);
}

function prev() {
  const r = store.runtime;
  if (r.screen === 'diploma') { r.screen = 'finale'; return; }
  if (r.screen === 'finale') { r.screen = 'leaderboard'; return; }
  if (r.screen === 'leaderboard') { goContest(activeContests().length - 1, true); return; }
  if (r.screen === 'guests') { r.screen = 'welcome'; return; }
  if (r.screen === 'welcome') return;

  if (r.phase === 'reveal') { r.phase = 'question'; return; }
  if (r.phase === 'question') {
    const contest = currentContest();
    const at = itemPos(contest);
    if (at > 0) { setPos(contest, at - 1, 'reveal'); return; }
    r.phase = 'intro';
    return;
  }
  goContest(contestPos() - 1, true);
}

// Конкурс могли выключить или удалить прямо посреди показа. Тогда переходим
// к ближайшему следующему активному, а не прыгаем куда попало.
function ensurePosition(fromIndexInShow) {
  const r = store.runtime;
  const list = activeContests();
  if (!list.length) { r.contestId = ''; r.itemId = ''; return; }

  const contest = currentContest();
  if (contest) {
    const items = itemsOf(contest);
    if (items.length && itemPos(contest) < 0) setPos(contest, 0, 'intro');
    return;
  }

  const all = store.show.contests || [];
  const from = typeof fromIndexInShow === 'number' ? Math.max(0, fromIndexInShow) : 0;
  let next = null;
  for (let i = from; i < all.length; i++) {
    if (all[i].enabled !== false) { next = all[i]; break; }
  }
  if (!next) next = list[list.length - 1];

  // Экран не трогаем: если ведущий не в показе, просто запоминаем новое место.
  const screen = r.screen;
  goContest(list.indexOf(next), false);
  r.screen = screen;
}

// ——— раунды ———
//
// Раунд — это один вопрос одного конкурса: кто что ответил и начислены ли
// за него баллы. Раньше такое хранилище было только у «Ставок» (runtime.bets),
// жило отдельной командой и никогда не чистилось.

function roundKey(contest, item) {
  return contest && item ? contest.id + '/' + item.id : '';
}

function currentItem() {
  const contest = currentContest();
  if (!contest) return null;
  return itemsOf(contest).find((it) => it.id === store.runtime.itemId) || null;
}

// Держим последние шесть раундов: текущий и пять предыдущих — их хватает,
// чтобы отменить начисление и вернуться на пару вопросов назад.
const KEEP_ROUNDS = 6;

function roundAt(key, create) {
  const r = store.runtime;
  if (!r.rounds) r.rounds = {};
  if (!Array.isArray(r.roundOrder)) r.roundOrder = [];
  if (!key) return null;
  if (!r.rounds[key]) {
    if (!create) return null;
    r.rounds[key] = { votes: {}, awarded: false, gen: 0 };
  }
  const at = r.roundOrder.indexOf(key);
  if (at >= 0) r.roundOrder.splice(at, 1);
  r.roundOrder.push(key);
  while (r.roundOrder.length > KEEP_ROUNDS) {
    delete r.rounds[r.roundOrder.shift()];
  }
  return r.rounds[key];
}

// Кто выиграл раунд — решает правило, которое объявил сам формат.
function pickWinners(scoring, item, round) {
  const votes = (round && round.votes) || {};
  const ids = Object.keys(votes);
  if (!ids.length) return [];

  if (scoring.rule === 'exact') {
    const right = item[scoring.field || 'answer'];
    if (!Number.isInteger(right)) return [];
    return ids.filter((id) => Number(votes[id].v) === right);
  }

  if (scoring.rule === 'nearest') {
    const target = Number(item[scoring.field || 'value']);
    if (!isFinite(target) || item[scoring.field || 'value'] === null) return [];
    let best = Infinity;
    let out = [];
    for (const id of ids) {
      const v = Number(votes[id].v);
      if (!isFinite(v)) continue;
      const diff = Math.abs(v - target);
      if (diff < best - 1e-9) { best = diff; out = [id]; }
      else if (Math.abs(diff - best) < 1e-9) out.push(id);
    }
    return scoring.tie === 'first' ? out.slice(0, 1) : out;
  }

  return [];
}

function pointsFor(contest) {
  const base = Number(contest && contest.pointsPerCorrect);
  const mult = Number(contest && contest.multiplier);
  return Math.max(0, (base > 0 ? base : 1) * (mult > 0 ? mult : 1));
}

// Раскрыли ответ — раздаём баллы. Ровно один раз на раунд: повторное
// «показать/скрыть» ничего не удвоит.
function settleRound() {
  const r = store.runtime;
  if (r.screen !== 'show' || r.phase !== 'reveal') return [];
  const contest = currentContest();
  const item = currentItem();
  if (!contest || !item) return [];

  const round = roundAt(roundKey(contest, item), false);
  if (!round || round.awarded) return [];

  const decl = types.get(contest.type);
  const scoring = (decl && decl.scoring) || { rule: 'manual' };
  if (scoring.rule === 'manual') return [];

  const winners = pickWinners(scoring, item, round);
  round.awarded = true;
  if (!winners.length) return [];
  const delta = pointsFor(contest);
  return applyAward(winners.map((id) => ({ id, delta })), contest.title, roundKey(contest, item));
}

// ——— жужжалка ———
//
// «Кто первый» решает сервер по времени прихода команды. Wi-Fi у всех разный,
// поэтому вычитаем половину пинга телефона — и не больше 150 мс, чтобы нельзя
// было «выиграть», приписав себе задержку.
//
// Нажатия в первые 150 мс считаются одновременными: внутри окна очередь
// пересортировывается, после — замерзает. Человек 150 мс не различает, а
// разброс домашней сети укладывается в них целиком.

const BUZZ_WINDOW = 150;
const FALSE_START_PAUSE = 2000;

function buzzOf(round) {
  if (!round.buzz) round.buzz = { open: false, locked: false, order: [], falseStart: {}, freezeAt: 0 };
  return round.buzz;
}

function freezeLater(key) {
  setTimeout(() => {
    const round = (store.runtime.rounds || {})[key];
    if (!round || !round.buzz) return;
    round.buzz.order.sort((a, b) => a.at - b.at);
    round.buzz.frozen = true;
    store.touch('runtime');
    store.emit();
  }, BUZZ_WINDOW + 10);
}

// ——— таймер ———
//
// Сервер не тикает. Он хранит момент, когда время выйдет, а считают все
// страницы сами — по часам сервера. Про истечение сообщает телевизор.

function startTimer(seconds, onEnd, label) {
  const r = store.runtime;
  const secs = Math.max(1, Math.min(3600, Math.round(Number(seconds) || 60)));
  r.timer = {
    seconds: secs,
    endsAt: Date.now() + secs * 1000,
    leftPaused: 0,
    running: true,
    seq: (r.timer && r.timer.seq ? r.timer.seq : 0) + 1,
    onEnd: ['stop', 'reveal', 'next'].includes(onEnd) ? onEnd : 'stop',
    label: String(label || '').slice(0, 60),
    contestId: r.contestId,
    itemId: r.itemId
  };
  return ['runtime'];
}

// Формат может попросить таймер сам: «на этот вопрос — минута».
// Число берётся либо из объявления, либо из поля вопроса, если там имя поля.
function autoTimer() {
  const r = store.runtime;
  if (r.screen !== 'show' || r.phase !== 'question') return;
  const contest = currentContest();
  const item = currentItem();
  if (!contest || !item) return;

  const decl = types.get(contest.type);
  const conf = decl && decl.timer;
  if (!conf || conf.autoStart !== 'question') return;

  const t = r.timer;
  // Уже идёт на этом же вопросе — не перезапускаем.
  if (t && t.contestId === contest.id && t.itemId === item.id) return;

  const seconds = typeof conf.seconds === 'string' ? Number(item[conf.seconds]) : Number(conf.seconds);
  startTimer(seconds, conf.onEnd, conf.label);
}

// ——— баллы ———

// Единственное место, где меняется счёт. Пишем в журнал ровно те дельты,
// которые реально применились (счёт не уходит ниже нуля), — тогда отмена
// возвращает всё точь-в-точь.
function applyAward(entries, reason, roundKey) {
  const done = [];
  for (const e of entries || []) {
    const owner = findOwner(e.id);
    if (!owner) continue;
    const was = Number(owner.score) || 0;
    const now = Math.max(0, was + (Number(e.delta) || 0));
    if (now === was) continue;
    owner.score = now;
    done.push({ id: e.id, delta: now - was });
  }
  if (!done.length) return [];

  const r = store.runtime;
  const seq = (r.lastAward && r.lastAward.seq ? r.lastAward.seq : 0) + 1;
  r.lastAward = { seq, entries: done };
  r.awardLog = (r.awardLog || []).concat([{
    seq,
    at: Date.now(),
    reason: String(reason || ''),
    // За какой вопрос начислено — по этому экран показывает, кто угадал.
    roundKey: roundKey || '',
    entries: done
  }]).slice(-20);
  return ['guests', 'runtime'];
}

function revertAward(entry) {
  for (const e of entry.entries || []) {
    const owner = findOwner(e.id);
    if (owner) owner.score = Math.max(0, (Number(owner.score) || 0) - e.delta);
  }
  entry.undone = true;
  const r = store.runtime;
  r.lastAward = {
    seq: (r.lastAward && r.lastAward.seq ? r.lastAward.seq : 0) + 1,
    entries: (entry.entries || []).map((e) => ({ id: e.id, delta: -e.delta }))
  };
  return ['guests', 'runtime'];
}

// ——— команды ———

const handlers = {
  next() { next(); autoTimer(); return ['runtime'].concat(settleRound()); },
  prev() { prev(); autoTimer(); return ['runtime']; },

  goScreen({ screen }) {
    if (!SCREENS.includes(screen)) return [];
    store.runtime.screen = screen;
    if (screen === 'show') ensurePosition();
    return ['runtime'];
  },

  // Пульт присылает id. Номера тоже принимаем — на случай старой вкладки.
  goto({ contestId, itemId, contestIndex, itemIndex, phase }) {
    const list = activeContests();
    if (!list.length) return [];
    const r = store.runtime;

    let contest = contestId ? list.find((c) => c.id === contestId) : null;
    if (!contest) contest = list[clamp(Number(contestIndex) || 0, 0, list.length - 1)];

    const items = itemsOf(contest);
    let at = itemId ? items.findIndex((it) => it.id === itemId) : -1;
    if (at < 0) at = clamp(Number(itemIndex) || 0, 0, Math.max(0, items.length - 1));

    r.screen = 'show';
    const want = ['intro', 'question', 'reveal'].includes(phase) ? phase : 'question';
    setPos(contest, at, items.length ? want : 'intro');
    autoTimer();
    return ['runtime'].concat(settleRound());
  },

  reveal({ on }) {
    const r = store.runtime;
    if (r.screen !== 'show' || r.phase === 'intro') return [];
    r.phase = on === false ? 'question' : 'reveal';
    return ['runtime'].concat(settleRound());
  },

  fx({ type }) {
    const r = store.runtime;
    r.fx = { type: String(type || ''), seq: (r.fx && r.fx.seq ? r.fx.seq : 0) + 1 };
    return ['runtime'];
  },

  music({ on }) {
    const r = store.runtime;
    r.music = { on: !!on, seq: (r.music && r.music.seq ? r.music.seq : 0) + 1 };
    return ['runtime'];
  },

  lionSay({ text }) {
    store.runtime.lionLine = String(text || '').slice(0, 240);
    return ['runtime'];
  },

  video(payload) {
    const r = store.runtime;
    r.video = {
      action: String(payload.action || 'pause'),
      at: Number(payload.at) || 0,
      until: Number(payload.until) || 0,
      seq: (r.video && r.video.seq ? r.video.seq : 0) + 1
    };
    return ['runtime'];
  },

  award(payload) {
    const id = payload.id || payload.teamId || payload.guestId;
    return applyAward([{ id, delta: Number(payload.delta) || 0 }], payload.reason || '');
  },

  // Отменить последнее начисление. Раньше ошибку можно было исправить
  // только вручную минусами, и то не всегда точно.
  undo() {
    const log = store.runtime.awardLog || [];
    for (let i = log.length - 1; i >= 0; i--) {
      if (!log[i].undone) return revertAward(log[i]);
    }
    return [];
  },

  undoAward({ seq }) {
    const entry = (store.runtime.awardLog || []).find((e) => e.seq === Number(seq) && !e.undone);
    return entry ? revertAward(entry) : [];
  },

  setScore(payload) {
    const owner = findOwner(payload.id || payload.teamId || payload.guestId);
    if (!owner) return [];
    owner.score = Math.max(0, Number(payload.score) || 0);
    return ['guests'];
  },

  resetScores() {
    store.guests.list.forEach((g) => { g.score = 0; });
    store.guests.teams.forEach((t) => { t.score = 0; });
    // Журнал начислений тоже обнуляем: отменять уже нечего.
    store.runtime.awardLog = [];
    store.runtime.lastAward = null;
    return ['guests', 'runtime'];
  },

  setMode({ mode }) {
    store.show.mode = mode === 'guests' ? 'guests' : 'teams';
    return ['show'];
  },

  addTeam({ name, avatar, color }) {
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) return [];
    const used = store.guests.teams.length;
    store.guests.teams.push({
      id: newId('t'),
      name: clean,
      avatar: avatar || AVATARS[(used + 3) % AVATARS.length],
      color: color || COLORS[used % COLORS.length],
      score: 0
    });
    return ['guests'];
  },

  updateTeam({ id, name, avatar, color }) {
    const t = store.guests.teams.find((x) => x.id === id);
    if (!t) return [];
    if (name !== undefined) t.name = String(name).trim().slice(0, 40) || t.name;
    if (avatar !== undefined) t.avatar = avatar;
    if (color !== undefined) t.color = color;
    return ['guests'];
  },

  removeTeam({ id }) {
    store.guests.teams = store.guests.teams.filter((t) => t.id !== id);
    store.guests.list.forEach((g) => { if (g.teamId === id) g.teamId = ''; });
    return ['guests'];
  },

  // Ответ участника на текущем вопросе. В режиме «только пульт» его вводит
  // ведущий, потом сюда же будут приходить ответы с телефонов гостей.
  vote({ ownerId, value }) {
    const contest = currentContest();
    const item = currentItem();
    if (!contest || !item || !ownerId) return [];
    const round = roundAt(roundKey(contest, item), true);

    if (value === '' || value === null || value === undefined) {
      delete round.votes[ownerId];
      return ['runtime'];
    }

    // Каким должен быть ответ, знает формат: число, номер варианта или текст.
    // Раньше сервер угадывал это по самому значению — и «7 лет» становилось
    // числом, а «7» из текстового ответа теряло смысл.
    const decl = types.get(contest.type);
    const kind = ((decl && decl.participation && decl.participation.vote) || {}).kind;
    round.votes[ownerId] = {
      v: kind === 'text' ? String(value).slice(0, 300) : Number(value),
      at: Date.now()
    };
    return ['runtime'];
    return ['runtime'];
  },

  clearVotes() {
    const round = roundAt(roundKey(currentContest(), currentItem()), false);
    if (!round) return [];
    round.votes = {};
    return ['runtime'];
  },

  // Переиграть вопрос: ответы стираются, баллы за него можно начислить заново.
  resetRound() {
    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    round.votes = {};
    round.awarded = false;
    round.buzz = { open: false, locked: false, order: [], falseStart: {}, freezeAt: 0 };
    round.gen = (round.gen || 0) + 1;
    return ['runtime'];
  },

  addGuest({ name, avatar, color, teamId }) {
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) return [];
    const used = store.guests.list.length;
    store.guests.list.push({
      id: newId('g'),
      name: clean,
      avatar: avatar || AVATARS[used % AVATARS.length],
      color: color || COLORS[used % COLORS.length],
      score: 0,
      teamId: teamId || ''
    });
    return ['guests'];
  },

  updateGuest({ id, name, avatar, color, teamId }) {
    const g = store.guests.list.find((x) => x.id === id);
    if (!g) return [];
    if (name !== undefined) g.name = String(name).trim().slice(0, 40) || g.name;
    if (avatar !== undefined) { g.avatar = avatar; delete g.emoji; }
    if (color !== undefined) g.color = color;
    if (teamId !== undefined) g.teamId = teamId;
    return ['guests'];
  },

  removeGuest({ id }) {
    store.guests.list = store.guests.list.filter((x) => x.id !== id);
    return ['guests'];
  },

  saveContest({ contest }) {
    if (!contest || !contest.type) return [];
    const list = store.show.contests;
    const c = clone(contest);
    if (!c.id) c.id = newId('c');
    const i = list.findIndex((x) => x.id === c.id);
    if (i >= 0) list[i] = c; else list.push(c);
    // Вопрос, на котором мы стояли, мог исчезнуть при правке.
    ensurePosition();
    return ['show', 'runtime'];
  },

  deleteContest({ id }) {
    const at = (store.show.contests || []).findIndex((c) => c.id === id);
    store.show.contests = store.show.contests.filter((c) => c.id !== id);
    ensurePosition(at);
    return ['show', 'runtime'];
  },

  toggleContest({ id, enabled }) {
    const list = store.show.contests;
    const c = list.find((x) => x.id === id);
    if (!c) return [];
    c.enabled = enabled === undefined ? c.enabled === false : !!enabled;
    // Выключили тот конкурс, что сейчас на экране, — переходим к следующему.
    ensurePosition(list.findIndex((x) => x.id === id));
    return ['show', 'runtime'];
  },

  moveContest({ id, dir }) {
    const list = store.show.contests;
    const i = list.findIndex((c) => c.id === id);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return [];
    const [c] = list.splice(i, 1);
    list.splice(j, 0, c);
    return ['show'];
  },

  // Репетиция: запоминаем баллы и позицию, а на выходе возвращаем всё как было.
  rehearsal({ on }) {
    const r = store.runtime;
    if (on) {
      if (r.rehearsal) return [];
      r.rehearsal = {
        scores: store.guests.list.concat(store.guests.teams).map((o) => ({ id: o.id, score: o.score || 0 })),
        screen: r.screen,
        contestId: r.contestId,
        itemId: r.itemId,
        phase: r.phase
      };
      return ['runtime'];
    }
    const snap = r.rehearsal;
    if (!snap) return [];
    for (const s2 of snap.scores || []) {
      const owner = findOwner(s2.id);
      if (owner) owner.score = s2.score;
    }
    r.screen = snap.screen;
    r.contestId = snap.contestId || '';
    r.itemId = snap.itemId || '';
    r.phase = snap.phase;
    r.rehearsal = null;
    return ['runtime', 'guests'];
  },

  // ——— свой карман формата ———

  // Случайное число, одинаковое для всех экранов. Что оно значит, решает
  // формат: сектор колеса, номер фанта, порядок выступления. Главное, что
  // тянет его сервер: иначе телевизор и телефон покажут разное.
  roll({ key, max }) {
    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    const n = Math.max(1, Math.min(1000, Math.round(Number(max) || 1)));
    if (!round.slice) round.slice = {};
    const name = String(key || 'roll').slice(0, 30);
    const prev = round.slice[name];
    round.slice[name] = {
      value: Math.floor(Math.random() * n),
      seq: (prev && prev.seq ? prev.seq : 0) + 1
    };
    return ['runtime'];
  },

  // Формат может отложить в раунд что-то своё: отметку судьи, номер
  // участника, промежуточный итог. Ядро в это не заглядывает.
  // Формат может отложить что-то своё: отметку судьи, номер участника,
  // промежуточный итог. Ядро в это не заглядывает.
  //
  // scope: «round» — при вопросе (по умолчанию), «contest» — на весь номер.
  // Блицу нужен именно второй: счёт не должен обнуляться на каждом вопросе.
  setSlice({ patch, scope }) {
    if (!patch || typeof patch !== 'object') return [];

    if (scope === 'contest') {
      const contest = currentContest();
      if (!contest) return [];
      const all = store.runtime.contestSlices = store.runtime.contestSlices || {};
      all[contest.id] = Object.assign(all[contest.id] || {}, patch);
      return ['runtime'];
    }

    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    round.slice = Object.assign(round.slice || {}, patch);
    return ['runtime'];
  },

  // ——— жужжалка ———

  // Дать сигнал: с этой секунды нажатия считаются.
  armBuzz({ on }) {
    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    const b = buzzOf(round);
    b.open = on !== false;
    if (b.open) {
      b.locked = false;
      b.order = [];
      b.freezeAt = 0;
      b.frozen = false;
    }
    return ['runtime'];
  },

  buzz({ playerId, ownerId, rtt }) {
    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    const b = buzzOf(round);

    const player = store.play.players[playerId];
    const owner = findOwner(ownerId || (player && player.ownerId));
    if (!owner) return [];

    const now = Date.now();

    // Нажали до сигнала — фальстарт: две секунды кнопка не слушается.
    if (!b.open || b.locked) {
      b.falseStart[owner.id] = now + FALSE_START_PAUSE;
      return ['runtime'];
    }
    if (now < (b.falseStart[owner.id] || 0)) return [];
    // Из семьи в очередь попадает один — второй телефон ничего не меняет.
    if (b.order.some((x) => x.ownerId === owner.id)) return [];

    const lag = Math.min(300, Math.max(0, Number(rtt) || 0)) / 2;
    b.order.push({ ownerId: owner.id, playerId: playerId || '', at: now - lag, raw: now });

    if (!b.freezeAt) {
      b.freezeAt = now + BUZZ_WINDOW;
      freezeLater(roundKey(currentContest(), currentItem()));
    }
    return ['runtime'];
  },

  // Ведущий подтвердил ответ первого в очереди.
  buzzCorrect() {
    const contest = currentContest();
    const round = roundAt(roundKey(contest, currentItem()), false);
    if (!round || !round.buzz || !round.buzz.order.length) return [];
    const first = round.buzz.order[0];
    round.buzz.locked = true;
    round.buzz.open = false;
    return ['runtime'].concat(
      applyAward([{ id: first.ownerId, delta: pointsFor(contest) }],
        contest.title, roundKey(contest, currentItem()))
    );
  },

  // Не угадал — очередь двигается к следующему.
  buzzMiss() {
    const round = roundAt(roundKey(currentContest(), currentItem()), false);
    if (!round || !round.buzz || !round.buzz.order.length) return [];
    round.buzz.order.shift();
    return ['runtime'];
  },

  clearBuzz() {
    const round = roundAt(roundKey(currentContest(), currentItem()), false);
    if (!round || !round.buzz) return [];
    round.buzz = { open: false, locked: false, order: [], falseStart: {}, freezeAt: 0 };
    return ['runtime'];
  },

  // ——— таймер ———

  timerStart({ seconds, onEnd, label }) {
    return startTimer(seconds, onEnd, label);
  },

  timerPause() {
    const t = store.runtime.timer;
    if (!t || !t.running) return [];
    t.leftPaused = Math.max(0, t.endsAt - Date.now());
    t.running = false;
    return ['runtime'];
  },

  timerResume() {
    const t = store.runtime.timer;
    if (!t || t.running) return [];
    t.endsAt = Date.now() + (Number(t.leftPaused) || 0);
    t.leftPaused = 0;
    t.running = true;
    return ['runtime'];
  },

  timerAdd({ seconds }) {
    const t = store.runtime.timer;
    if (!t) return [];
    const add = (Number(seconds) || 0) * 1000;
    if (t.running) t.endsAt = Math.max(Date.now(), t.endsAt + add);
    else t.leftPaused = Math.max(0, (Number(t.leftPaused) || 0) + add);
    // Кольцо на экране считает долю от исходного времени — растянем и его.
    if (add > 0) t.seconds += Math.round(add / 1000);
    return ['runtime'];
  },

  timerReset() {
    if (!store.runtime.timer) return [];
    store.runtime.timer = null;
    return ['runtime'];
  },

  // Время вышло — об этом сообщает телевизор. Повтор с тем же номером
  // запуска ничего не делает, поэтому второй экран не навредит.
  timerDone({ seq }) {
    const r = store.runtime;
    const t = r.timer;
    if (!t || !t.running || Number(seq) !== t.seq) return [];
    t.running = false;
    t.leftPaused = 0;
    t.done = true;

    if (t.onEnd === 'reveal' && r.screen === 'show' && r.phase === 'question') {
      r.phase = 'reveal';
      return ['runtime'].concat(settleRound());
    }
    if (t.onEnd === 'next') {
      next();
      autoTimer();
      return ['runtime'].concat(settleRound());
    }
    return ['runtime'];
  },

  // ——— телефоны гостей ———

  // Гость выбрал себя на экране «Кто ты?». Ни сессий, ни паролей:
  // это домашняя сеть на четыре часа, а не банк.
  join({ playerId, ownerId, name }) {
    const id = String(playerId || '').slice(0, 40);
    if (!id) return [];
    const owner = findOwner(ownerId);
    if (!owner) return [];

    const was = store.play.players[id];
    store.play.players[id] = {
      id,
      ownerId: owner.id,
      name: String(name || owner.name || '').slice(0, 40),
      joinedAt: (was && was.joinedAt) || Date.now(),
      seenAt: Date.now()
    };
    return ['play'];
  },

  leave({ playerId }) {
    if (!store.play.players[playerId]) return [];
    delete store.play.players[playerId];
    return ['play'];
  },

  // Ведущий может отвязать чужой телефон из кабинета.
  kickPlayer({ playerId }) {
    if (!store.play.players[playerId]) return [];
    delete store.play.players[playerId];
    return ['play'];
  },

  // Как играем: всё с пульта ведущего или гости отвечают со своих телефонов.
  setPlayMode({ mode }) {
    store.show.playMode = mode === 'phones' ? 'phones' : 'host';
    return ['show'];
  },

  updateShow({ patch }) {
    Object.assign(store.show, patch || {});
    return ['show'];
  },

  importShow({ show, guests, teams }) {
    if (show && Array.isArray(show.contests)) store.show = clone(show);
    if (Array.isArray(guests)) store.guests.list = clone(guests);
    if (Array.isArray(teams)) store.guests.teams = clone(teams);
    return ['show', 'guests'];
  }
};

function applyCommand(type, payload) {
  const fn = handlers[type];
  if (!fn) return { ok: false, error: 'Неизвестная команда: ' + type };
  const changed = fn(payload || {}) || [];
  if (changed.length) store.touch(...changed);
  else store.version += 1;
  return { ok: true };
}

module.exports = { applyCommand, activeContests, AVATARS, COLORS };
