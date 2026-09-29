'use strict';

// Commands shared by every remote; selections and clocks belong to the server.
const { store } = require('./store');
const { randomInt } = require('node:crypto');
const limit = (v, lo, hi, fallback) => Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : fallback;
const localMedia = (v) => typeof v === 'string' && /^\/?media\//.test(v) && !v.includes('..');
const position = (d) => (d.position || 0) + (d.playing ? (Date.now() - d.startedAt) / 1000 : 0);

module.exports = {
  dj(p) {
    const r = store.runtime;
    const d = { ...(r.dj || { src: '', playing: false, position: 0, volume: .35, loop: false, talking: false, seq: 0 }) };
    d.position = position(d);
    if (p.src !== undefined) {
      if (!localMedia(p.src)) return [];
      d.src = p.src; d.position = 0;
    }
    if (p.position !== undefined) d.position = limit(p.position, 0, 86400, 0);
    if (p.volume !== undefined) d.volume = limit(p.volume, 0, 1, .35);
    for (const k of ['playing', 'loop', 'talking']) if (p[k] !== undefined) d[k] = !!p[k];
    if (!d.src) d.playing = false;
    d.startedAt = Date.now(); d.seq++;
    r.dj = d;
    if (d.playing) r.music = { on: false, seq: (r.music?.seq || 0) + 1 };
    return ['runtime'];
  },
  partyDraw({ ids, count, reset, close, excludeUsed }) {
    const r = store.runtime;
    const old = r.partyDraw || {};
    if (close) { r.partyDraw = { ...old, open: false }; return ['runtime']; }
    if (reset) { r.partyDraw = { open: false, used: [], seq: (old.seq || 0) + 1 }; return ['runtime']; }
    if (old.open && Date.now() < old.endsAt) return [];
    const used = old.used || [];
    const allowed = new Set(Array.isArray(ids) ? ids : []);
    const pool = store.guests.list.filter(g => allowed.has(g.id) && (!excludeUsed || !used.includes(g.id)));
    const n = count === 2 ? 2 : 1;
    if (pool.length < n) return [];
    const candidates = pool.map(g => ({ id: g.id, name: g.name }));
    const picks = [];
    for (let i = 0; i < n; i++) picks.push(pool.splice(randomInt(pool.length), 1)[0]);
    const startedAt = Date.now();
    r.partyDraw = { open: true, candidates, picks: picks.map(g => ({ id: g.id, name: g.name })),
      used: [...new Set([...used, ...picks.map(g => g.id)])], startedAt, endsAt: startedAt + n * 4500,
      seq: (old.seq || 0) + 1 };
    if (r.album) r.album.open = false;
    if (r.ceremony) r.ceremony.open = false;
    if (r.capsuleStage) r.capsuleStage.open = false;
    return ['runtime'];
  },
  album(p) {
    const r = store.runtime;
    const a = r.album || { open: false, playing: false, index: 0, seconds: 6, loop: true, frames: [], seq: 0 };
    const elapsed = a.playing ? Math.floor((Date.now() - a.startedAt) / (a.seconds * 1000)) : 0;
    a.index = a.frames.length ? (a.loop ? (a.index + elapsed) % a.frames.length : Math.min(a.frames.length - 1, a.index + elapsed)) : 0;
    if (Array.isArray(p.frames)) {
      a.frames = p.frames.filter(f => f && localMedia(f.src)).slice(0, 500).map(f => ({ src: f.src, caption: String(f.caption || '').slice(0, 250) }));
      a.index = 0;
    }
    if (p.seconds !== undefined) a.seconds = limit(p.seconds, 3, 60, 6);
    if (p.delta) a.index = a.frames.length ? (a.index + (p.delta > 0 ? 1 : -1) + a.frames.length) % a.frames.length : 0;
    for (const k of ['open', 'playing', 'loop']) if (p[k] !== undefined) a[k] = !!p[k];
    if (!a.frames.length) a.open = a.playing = false;
    if (!a.open) a.playing = false;
    a.startedAt = Date.now(); a.seq++; r.album = a;
    if (a.open && r.partyDraw) r.partyDraw.open = false;
    if (a.open && r.ceremony) r.ceremony.open = false;
    if (a.open && r.capsuleStage) r.capsuleStage.open = false;
    return ['runtime'];
  },
  partySilence() {
    const r = store.runtime;
    if (r.dj) { r.dj.position = position(r.dj); r.dj.playing = false; r.dj.seq++; }
    r.music = { on: false, seq: (r.music?.seq || 0) + 1 };
    r.silenceSeq = (r.silenceSeq || 0) + 1;
    return ['runtime'];
  }
};
