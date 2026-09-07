'use strict';

const { store, clone } = require('./store');

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

// ——— баллы ———

// Единственное место, где меняется счёт. Пишем в журнал ровно те дельты,
// которые реально применились (счёт не уходит ниже нуля), — тогда отмена
// возвращает всё точь-в-точь.
function applyAward(entries, reason) {
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
  r.awardLog = (r.awardLog || []).concat([{ seq, at: Date.now(), reason: String(reason || ''), entries: done }]).slice(-20);
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
  next() { next(); return ['runtime']; },
  prev() { prev(); return ['runtime']; },

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
    return ['runtime'];
  },

  reveal({ on }) {
    const r = store.runtime;
    if (r.screen !== 'show' || r.phase === 'intro') return [];
    r.phase = on === false ? 'question' : 'reveal';
    return ['runtime'];
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

  // Ставки: у каждой семьи своё число на текущем вопросе.
  bet({ key, ownerId, value }) {
    const r = store.runtime;
    if (!r.bets) r.bets = {};
    const k = String(key || '');
    if (!k || !ownerId) return [];
    if (!r.bets[k]) r.bets[k] = {};
    if (value === '' || value === null || value === undefined) delete r.bets[k][ownerId];
    else r.bets[k][ownerId] = Number(value);
    return ['runtime'];
  },

  clearBets({ key }) {
    const r = store.runtime;
    if (r.bets) delete r.bets[String(key || '')];
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
