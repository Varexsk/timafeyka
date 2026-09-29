import { serverNow, send } from './bus.js';
import { esc } from './util.js';
import * as sfx from './sfx.js';
import * as music from './music.js';
import { paintDirector, updateDirectorTV } from './director-tv.js';
let fullState;

let runtime = {}, overlay, audio, gain, applied = -1, silence = 0, frameKey = '', wheelKey = '', revealKey = '', tickKey = '';
let muted = false;
let lastGain = -1, silentDraw = -1;
let wasOverlay = false;
let seenFx = 0, fxUntil = 0;
function buildAudio() {
  if (audio || !sfx.isReady()) return;
  audio = new Audio(); audio.preload = 'auto';
  const ctx = sfx.getContext();
  gain = ctx.createGain(); ctx.createMediaElementSource(audio).connect(gain).connect(sfx.getMusicBus());
  audio.addEventListener('ended', () => { if (runtime.dj?.playing && !runtime.dj.loop) send('dj', { playing: false, position: audio.duration }); });
  audio.addEventListener('error', () => { if (runtime.dj?.playing) send('dj', { playing: false }); });
}
function syncAudio() {
  buildAudio(); if (!audio || !runtime.dj) return;
  const d = runtime.dj;
  if (applied !== d.seq) {
    applied = d.seq;
    if (audio.getAttribute('src') !== d.src && d.src) audio.src = d.src;
    audio.loop = !!d.loop;
    const seek = () => {
      let pos = (d.position || 0) + (d.playing ? Math.max(0, (serverNow() - d.startedAt) / 1000) : 0);
      if (Number.isFinite(audio.duration)) pos = d.loop ? pos % audio.duration : Math.min(pos, audio.duration);
      if (Math.abs(audio.currentTime - pos) > .7) audio.currentTime = pos;
    };
    if (audio.readyState >= 1) seek(); else audio.onloadedmetadata = seek;
    if (d.playing && d.src) { music.setOn(false); audio.play().catch(() => { applied = -1; }); }
    else setTimeout(() => { if (!runtime.dj?.playing) audio.pause(); }, 400);
  }
  const mediaPlaying = [...document.querySelectorAll('video, audio')].some(m => !m.paused && !m.ended);
  const level = d.playing && !muted ? (d.volume ?? .35) * (d.talking || mediaPlaying || serverNow() < fxUntil ? .15 : 1) : 0;
  if (level !== lastGain) { lastGain = level; gain.gain.setTargetAtTime(level, sfx.getContext().currentTime, .12); }
}

// На секторе колеса мало места: «Прабабушка Лина» доставала до звезды
// в центре. Роль сокращаем по-домашнему, а полное имя остаётся в билете.
const ROLES = [[/^прабабушка\s+/i, 'Прабаба '], [/^прадедушка\s+/i, 'Прадед '],
  [/^бабушка\s+/i, 'Баба '], [/^дедушка\s+/i, 'Дед '], [/^т[её]тушка\s+/i, 'Тётя ']];
function wheelName(name) {
  const rule = ROLES.find(([re]) => re.test(name));
  return rule ? name.replace(rule[0], rule[1]) : name;
}
function wheelMarkup(list) {
  const colors = ['#ef6572', '#f7c764', '#58c4b5', '#b59bdd', '#f4a679', '#8fbde1'];
  const n = list.length;
  const sectors = list.map((_, i) => `${colors[i % colors.length]} ${i * 100 / n}% ${(i + 1) * 100 / n}%`).join(',');
  // Много гостей — секторы узкие, буквы помельче, чтобы соседи не слипались.
  const scale = n > 16 ? .82 : n > 12 ? .9 : 1;
  return `<div class="party-wheel-box"><div class="party-pointer">▼</div><div class="party-wheel" style="background:conic-gradient(${sectors});--label-scale:${scale}">${list.map((g, i) => `<span style="--angle:${(i + .5) * 360 / n}deg"><b>${esc(wheelName(g.name))}</b></span>`).join('')}<i>★</i></div></div>`;
}
function paint() {
  if (!overlay) return;
  if (paintDirector(fullState, overlay)) { wheelKey = frameKey = ''; syncAudio(); return; }
  const w = runtime.partyDraw, a = runtime.album;
  const drawing = !!w?.open, showing = !!a?.open;
  if ((drawing || showing) && !wasOverlay) document.querySelectorAll('video, audio').forEach(m => m.pause());
  wasOverlay = drawing || showing;
  overlay.hidden = !drawing && !showing;
  document.body.classList.toggle('party-overlay-open', drawing || showing);
  if (drawing) {
    const elapsed = Math.max(0, serverNow() - w.startedAt);
    const round = Math.min(w.picks.length - 1, Math.floor(elapsed / 4500));
    const list = w.candidates.filter(g => !w.picks.slice(0, round).some(p => p.id === g.id));
    const key = `${w.seq}/${round}`;
    if (wheelKey !== key) {
      wheelKey = key; frameKey = '';
      overlay.className = 'party-overlay party-draw';
      overlay.innerHTML = `<p class="party-kicker">ЦИРК ТИМОШИ · ВЫХОД НА АРЕНУ</p><h1>${w.picks.length === 2 ? 'Два артиста — один номер' : 'Арена ждёт своего артиста'}</h1><div class="party-draw-body">${wheelMarkup(list)}<div class="party-results"><p>Приглашаем</p>${w.picks.map((_, i) => `<div class="party-ticket" data-pick="${i}"><small>АРТИСТ ${i + 1}</small><strong>✦ ✦ ✦</strong></div>`).join('')}</div></div>`;
      const wheel = overlay.querySelector('.party-wheel');
      const index = list.findIndex(g => g.id === w.picks[round].id);
      const angle = 1800 - (index + .5) * 360 / list.length;
      // Как и в CSS: в полном театре колесо крутится, даже если Windows
      // попросила сократить анимации, — иначе оно сразу вставало на итог.
      const reduced = !document.body.classList.contains('theater-full') && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const anim = wheel.animate([{ transform: `rotate(${reduced ? angle : 0}deg)` }, { transform: `rotate(${angle}deg)` }], { duration: 4100, easing: 'cubic-bezier(.12,.7,.13,1)', fill: 'forwards' });
      anim.currentTime = Math.min(4100, elapsed - round * 4500);
    }
    const local = elapsed - round * 4500;
    const tick = `${key}/${Math.floor(local / (local < 2400 ? 100 : 300))}`;
    if (local < 3900 && tick !== tickKey) { tickKey = tick; if (w.seq !== silentDraw) sfx.play('tick'); }
    w.picks.forEach((p, i) => {
      if (elapsed >= i * 4500 + 4100) {
        const ticket = overlay.querySelector(`[data-pick="${i}"]`);
        ticket.querySelector('strong').textContent = p.name; ticket.classList.add('is-revealed');
      }
    });
    const revealed = Math.min(w.picks.length, Math.floor((elapsed + 400) / 4500));
    const rk = `${w.seq}/${revealed}`;
    if (revealed > 0 && revealKey !== rk) { revealKey = rk; if (w.seq !== silentDraw) { fxUntil = serverNow() + 3000; sfx.play('tada'); } }
  } else if (showing && a.frames.length) {
    wheelKey = '';
    const advance = a.playing ? Math.floor(Math.max(0, serverNow() - a.startedAt) / (a.seconds * 1000)) : 0;
    const index = a.loop ? (a.index + advance) % a.frames.length : Math.min(a.index + advance, a.frames.length - 1);
    const f = a.frames[index], key = `${a.seq}/${index}`;
    if (frameKey !== key) {
      const same = overlay.dataset.frame === `${index}/${f.src}/${f.caption}` && !!overlay.querySelector('img');
      overlay.dataset.frame = `${index}/${f.src}/${f.caption}`;
      frameKey = key; overlay.className = 'party-overlay party-album';
      if (!same) overlay.innerHTML = `<div class="party-photo-halo"></div><img src="${esc(f.src)}" alt="${esc(f.caption || 'Фотография Тимофея')}" style="--photo-time:${a.seconds}s"><div class="party-photo-caption"><small>ТИМОФЕЙ · НАШ ПЕРВЫЙ ГОД</small><h1>${esc(f.caption || 'Маленькие моменты большого счастья')}</h1><span>${index + 1} / ${a.frames.length}</span></div>`;
      overlay.classList.toggle('is-paused', !a.playing);
    }
  } else { wheelKey = frameKey = ''; overlay.innerHTML = ''; }
  syncAudio();
}
export function mountPartyTV() {
  overlay = document.createElement('section'); overlay.hidden = true; overlay.className = 'party-overlay'; document.getElementById('stage').append(overlay);
  document.addEventListener('click', () => { if (sfx.isReady()) { applied = -1; syncAudio(); } });
  setInterval(paint, 100);
}
export function updatePartyTV(state) {
  fullState = state;
  updateDirectorTV(state);
  runtime = state.runtime;
  if (runtime.fx?.seq !== seenFx) { seenFx = runtime.fx?.seq; fxUntil = serverNow() + 3000; }
  if ((runtime.silenceSeq || 0) !== silence) {
    silence = runtime.silenceSeq || 0; muted = true;
    silentDraw = runtime.partyDraw?.seq ?? -1;
    sfx.silence();
    document.querySelectorAll('video, audio').forEach(m => m.pause());
  }
  if (runtime.dj?.playing) muted = false;
  paint();
}
