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

function currentContest() {
  return activeContests()[store.runtime.contestIndex] || null;
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
  r.contestIndex = i;
  const items = itemsOf(list[i]);
  if (atEnd) {
    r.itemIndex = Math.max(0, items.length - 1);
    r.phase = items.length ? 'reveal' : 'intro';
  } else {
    r.itemIndex = 0;
    r.phase = 'intro';
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

  if (r.phase === 'intro') {
    if (!items.length) { goContest(r.contestIndex + 1, false); return; }
    r.phase = 'question';
    r.itemIndex = 0;
    return;
  }
  if (r.phase === 'question') { r.phase = 'reveal'; return; }
  if (r.itemIndex + 1 < items.length) {
    r.itemIndex += 1;
    r.phase = 'question';
    return;
  }
  goContest(r.contestIndex + 1, false);
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
    if (r.itemIndex > 0) { r.itemIndex -= 1; r.phase = 'reveal'; return; }
    r.phase = 'intro';
    return;
  }
  goContest(r.contestIndex - 1, true);
}

// ——— команды ———

const handlers = {
  next() { next(); return ['runtime']; },
  prev() { prev(); return ['runtime']; },

  goScreen({ screen }) {
    if (!SCREENS.includes(screen)) return [];
    store.runtime.screen = screen;
    if (screen === 'show') {
      store.runtime.contestIndex = clamp(store.runtime.contestIndex, 0, Math.max(0, activeContests().length - 1));
    }
    return ['runtime'];
  },

  goto({ contestIndex, itemIndex, phase }) {
    const r = store.runtime;
    const list = activeContests();
    if (!list.length) return [];
    r.screen = 'show';
    r.contestIndex = clamp(Number(contestIndex) || 0, 0, list.length - 1);
    const items = itemsOf(list[r.contestIndex]);
    r.itemIndex = clamp(Number(itemIndex) || 0, 0, Math.max(0, items.length - 1));
    r.phase = ['intro', 'question', 'reveal'].includes(phase) ? phase : 'question';
    if (!items.length) r.phase = 'intro';
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
    const owner = findOwner(id);
    if (!owner) return [];
    const d = Number(payload.delta) || 0;
    owner.score = Math.max(0, (Number(owner.score) || 0) + d);
    const prevSeq = store.runtime.lastAward && store.runtime.lastAward.seq ? store.runtime.lastAward.seq : 0;
    store.runtime.lastAward = { id, delta: d, seq: prevSeq + 1 };
    return ['guests', 'runtime'];
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
    return ['guests'];
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
    return ['show'];
  },

  deleteContest({ id }) {
    store.show.contests = store.show.contests.filter((c) => c.id !== id);
    store.runtime.contestIndex = clamp(store.runtime.contestIndex, 0, Math.max(0, activeContests().length - 1));
    return ['show', 'runtime'];
  },

  toggleContest({ id, enabled }) {
    const c = store.show.contests.find((x) => x.id === id);
    if (!c) return [];
    c.enabled = enabled === undefined ? c.enabled === false : !!enabled;
    return ['show'];
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
        contestIndex: r.contestIndex,
        itemIndex: r.itemIndex,
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
    r.contestIndex = snap.contestIndex;
    r.itemIndex = snap.itemIndex;
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
