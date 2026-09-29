'use strict';
const { store, clone } = require('./store');
const party = require('./party');
const { randomUUID } = require('node:crypto');
const text = (v, n = 200) => String(v || '').trim().slice(0, n);
const media = v => typeof v === 'string' && /^\/?media\//.test(v) && !v.includes('..');
function motion(kind) { const r = store.runtime; r.lionAct = { kind, at: Date.now(), seq: (r.lionAct?.seq || 0) + 1 }; }
function fx(type) { const r = store.runtime; r.fx = { type, seq: (r.fx?.seq || 0) + 1 }; }
function closeOverlays() {
  for (const key of ['album', 'partyDraw', 'ceremony', 'albumStage']) if (store.runtime[key]) store.runtime[key].open = false;
}
function breakToggle(on) {
  const r = store.runtime;
  if (on === !!r.intermission?.open) return [];
  if (on) {
    const now = Date.now();
    const saved = clone({ timer: r.timer, dj: r.dj, music: r.music, album: r.album, partyDraw: r.partyDraw, ceremony: r.ceremony });
    if (saved.dj?.playing) saved.dj.position = (saved.dj.position || 0) + (now - saved.dj.startedAt) / 1000;
    if (r.timer?.running) { r.timer.leftPaused = Math.max(0, r.timer.endsAt - now); r.timer.running = false; }
    if (r.dj) { r.dj.playing = false; r.dj.seq++; }
    r.music = { on: false, seq: (r.music?.seq || 0) + 1 };
    closeOverlays();
    r.intermission = { open: true, at: now, saved, seq: (r.intermission?.seq || 0) + 1 };
    const settings = store.show.director || {};
    if (media(settings.breakTrack)) party.dj({ src: settings.breakTrack, playing: true, loop: true, volume: .18 });
    motion('bow');
  } else {
    const b = r.intermission, saved = b.saved || {}, elapsed = Date.now() - b.at;
    if (saved.timer) {
      r.timer = saved.timer;
      if (r.timer.running) r.timer.endsAt += elapsed;
    }
    for (const key of ['album', 'partyDraw', 'ceremony']) {
      const oldSeq = r[key]?.seq || 0;
      r[key] = saved[key] || null;
      if (r[key]) {
        r[key].seq = Math.max(oldSeq, r[key].seq || 0) + 1;
        if (r[key].startedAt) r[key].startedAt += elapsed;
        if (r[key].endsAt) r[key].endsAt += elapsed;
      }
    }
    r.dj = { ...(saved.dj || { playing: false, src: '', position: 0 }), seq: (r.dj?.seq || 0) + 1, startedAt: Date.now() };
    r.music = { on: !!saved.music?.on, seq: (r.music?.seq || 0) + 1 };
    r.intermission = { open: false, seq: b.seq + 1 };
    motion('enter');
  }
  return ['runtime'];
}
module.exports = {
  albumStage({ open }) { closeOverlays(); store.runtime.albumStage = { open: !!open }; return ['runtime']; },
  intermission({ on }) { return breakToggle(!!on); },
  directorSettings(p) {
    const d = store.show.director || (store.show.director = {});
    if (['full','calm'].includes(p.motion)) d.motion = p.motion;
    if (['auto','off'].includes(p.themeMusic)) d.themeMusic = p.themeMusic;
    for (const k of ['breakTrack', 'giftTrack']) if (p[k] === '' || media(p[k])) d[k] = p[k];
    if (p.breakAlbum !== undefined) d.breakAlbum = text(p.breakAlbum);
    return ['show'];
  },
  directorCue({ kind, guestId, title, ids, count }) {
    if (store.runtime.intermission?.open) return [];
    if (kind === 'entrance') {
      if (store.runtime.partyDraw?.open && Date.now() < store.runtime.partyDraw.endsAt) return { ok: false, error: 'Колесо ещё вращается' };
      const pool = Array.isArray(ids) ? ids : store.guests.list.filter(g => g.playing !== false).map(g => g.id);
      const used = store.runtime.partyDraw?.used || [];
      if (store.guests.list.filter(g => pool.includes(g.id) && !used.includes(g.id)).length < (count === 2 ? 2 : 1)) return { ok: false, error: 'Недостаточно участников' };
      closeOverlays(); party.partyDraw({ ids: pool, count: count === 2 ? 2 : 1, excludeUsed: true });
      fx('drumroll'); motion('enter');
    } else if (kind === 'gift') {
      const guest = store.guests.list.find(g => g.id === guestId);
      if (!guest) return { ok: false, error: 'Выберите гостя' };
      closeOverlays();
      const r = store.runtime;
      r.ceremony = { open: true, name: guest.name, title: text(title) || 'Звезда цирка Тимоши', startedAt: Date.now(), seq: (r.ceremony?.seq || 0) + 1 };
      if (!r.rehearsal) {
        const awards = store.show.honors || (store.show.honors = []);
        awards.push({ id: randomUUID(), guestId, name: guest.name, title: r.ceremony.title, at: Date.now() });
      }
      if (media(store.show.director?.giftTrack)) party.dj({ src: store.show.director.giftTrack, playing: true });
      motion('gift'); fx('tada');
    } else if (kind === 'close') { closeOverlays(); motion('bow'); }
    else return [];
    return ['runtime', 'show'];
  },
  lionAct({ kind }) {
    if (!['enter', 'bow', 'clap', 'surprise', 'gift'].includes(kind)) return [];
    motion(kind); return ['runtime'];
  },
  planUpdate({ id, minutes, props, reserve, direction }) {
    const list = store.show.contests, at = list.findIndex(c => c.id === id), c = list[at];
    if (!c) return [];
    if (minutes !== undefined) c.durationMinutes = Math.max(1, Math.min(120, Number(minutes) || 5));
    if (props !== undefined) c.propsNeeded = text(props, 500);
    if (reserve !== undefined && !(store.runtime.screen === 'show' && store.runtime.contestId === id)) { c.reserve = !!reserve; c.enabled = !reserve; }
    if (direction === -1 || direction === 1) {
      const to = at + direction;
      if (to >= 0 && to < list.length) [list[at], list[to]] = [list[to], list[at]];
    }
    return ['show'];
  },
  planLaunch({ id }) {
    if (store.runtime.intermission?.open) return [];
    const c = store.show.contests.find(c => c.id === id);
    if (!c) return [];
    c.reserve = false; c.enabled = true;
    Object.assign(store.runtime, { screen: 'show', contestId: c.id, itemId: c.items?.[0]?.id || '', phase: 'intro', timer: null });
    closeOverlays(); motion('enter');
    return ['show', 'runtime'];
  }
};
