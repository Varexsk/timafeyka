// Переход по программе закрывает колесо участников и прочие наложения.
//
// Раньше их закрывал только запуск номера из плана вечера. Ведущий крутил
// колесо «Выход на арену», выбирал конкурс на пульте — а колесо так и
// висело поверх сцены, пока не найдёшь кнопку «Закрыть колесо».

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-overlays-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

const send = (type, payload) => applyCommand(type, payload || {});
const r = () => store.runtime;

function withWheel() {
  store.load();
  store.resetToSeed();
  send('goScreen', { screen: 'show' });
  send('partyDraw', { ids: store.guests.list.map((g) => g.id), count: 1 });
  assert.equal(r().partyDraw.open, true, 'колесо открыто');
}

test('выбор конкурса на пульте закрывает колесо', () => {
  withWheel();
  const contest = store.show.contests.find((c) => c.enabled !== false && (c.items || []).length);
  send('goto', { contestId: contest.id, phase: 'intro' });
  assert.equal(r().partyDraw.open, false);
});

test('«Дальше» и «Назад» закрывают колесо', () => {
  withWheel();
  send('next');
  assert.equal(r().partyDraw.open, false);
  withWheel();
  send('prev');
  assert.equal(r().partyDraw.open, false);
});

test('переход на другой экран закрывает колесо', () => {
  withWheel();
  send('goScreen', { screen: 'leaderboard' });
  assert.equal(r().partyDraw.open, false);
});

test('выбранные участники после закрытия запоминаются', () => {
  withWheel();
  const picked = r().partyDraw.picks.map((p) => p.id);
  send('next');
  assert.deepEqual(picked.filter((id) => r().partyDraw.used.includes(id)), picked);
});

test('фотоальбом тоже закрывается, музыка не трогается', () => {
  store.load();
  store.resetToSeed();
  send('dj', { src: 'media/music/a.mp3', playing: true });
  send('album', { frames: [{ src: 'media/a.jpg', caption: '' }], open: true, playing: true });
  assert.equal(r().album.open, true, 'альбом открыт');
  const playing = r().dj && r().dj.playing;
  assert.equal(playing, true, 'музыка играет');
  send('next');
  assert.equal(r().album.open, false);
  assert.equal(r().dj && r().dj.playing, playing);
});
