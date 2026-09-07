// Фоновая цирковая музыка. Файл кладёт `npm run audio` в media/music —
// если его нет, все вызовы просто ничего не делают.

import * as sfx from './sfx.js';

const BASE = 0.18;      // фон должен быть слышен, но не мешать ведущему
const DUCKED = 0.035;   // пока играет своё аудио на экране
const FADE = 0.8;

let src = '';
let audio = null;
let node = null;
let gain = null;
let on = false;
let ducks = 0;
let dipTimer = 0;
let stopTimer = 0;

export function useMusicFiles(files) {
  if (src) return;
  const found = (files || []).find((f) => /^music\//.test(f.name || '') && f.kind === 'audio');
  if (found) src = found.path;
}

export function hasMusic() { return !!src; }
export function isOn() { return on; }

function build() {
  const ctx = sfx.getContext();
  if (!ctx || !src || audio) return !!audio;
  audio = new Audio(src);
  audio.loop = true;
  audio.preload = 'auto';
  node = ctx.createMediaElementSource(audio);
  gain = ctx.createGain();
  gain.gain.value = 0;
  node.connect(gain).connect(sfx.getMusicBus());
  return true;
}

function level() {
  if (!on) return 0;
  return ducks > 0 ? DUCKED : BASE;
}

function apply(seconds) {
  if (!gain) return;
  const ctx = sfx.getContext();
  const t = ctx.currentTime;
  const target = level();
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(target, t + (seconds === undefined ? FADE : seconds));

  clearTimeout(stopTimer);
  if (target > 0) {
    audio.play().catch(() => {});
  } else {
    // Останавливаем только после того, как затихло, иначе обрыв слышно.
    stopTimer = setTimeout(() => { if (!on && audio) audio.pause(); }, FADE * 1000 + 80);
  }
}

export function setOn(next) {
  if (!sfx.isReady() || !src) return;
  if (!build()) return;
  on = !!next;
  apply();
}

export function toggle() { setOn(!on); }

// Пока на экране играет свой ролик или трек — фон уходит вниз.
export function duck(active) {
  ducks = active ? ducks + 1 : Math.max(0, ducks - 1);
  apply(0.35);
}

// Короткий провал под дробь или фанфару.
export function dip(seconds) {
  if (!gain || !on) return;
  clearTimeout(dipTimer);
  ducks++;
  apply(0.2);
  dipTimer = setTimeout(() => { ducks = Math.max(0, ducks - 1); apply(0.6); }, (seconds || 2.5) * 1000);
}
