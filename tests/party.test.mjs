import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.CIRK_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-party-'));
const types = await import('../server/types.js'); await types.default.load();
const { store } = await import('../server/store.js');
const { applyCommand: send } = await import('../server/commands.js');
function reset() { store.load(); store.resetToSeed(); }

test('пара выбирается из отмеченных гостей, без повторов и без изменения конкурса', () => {
  reset();
  store.guests.list = ['a', 'b', 'c'].map(id => ({ id, name: id }));
  const before = [store.runtime.screen, store.runtime.contestId, store.runtime.itemId];
  send('partyDraw', { ids: ['a', 'b'], count: 2, excludeUsed: true });
  const w = store.runtime.partyDraw;
  assert.deepEqual(w.picks.map(p => p.id).sort(), ['a', 'b']);
  assert.equal(w.endsAt - w.startedAt, 9000);
  assert.deepEqual([store.runtime.screen, store.runtime.contestId, store.runtime.itemId], before);
  send('partyDraw', { ids: ['a', 'b', 'c'], count: 1 });
  assert.equal(store.runtime.partyDraw.seq, w.seq, 'повторный клик во время вращения игнорируется');
  send('partyDraw', { close: true });
  send('partyDraw', { ids: ['a', 'b', 'c'], count: 1, excludeUsed: true });
  assert.equal(store.runtime.partyDraw.picks[0].id, 'c');
});
test('недостаточный список и неизвестные гости не запускают колесо', () => {
  reset(); store.guests.list = [{ id: 'a', name: 'Аня' }];
  send('partyDraw', { ids: ['a', 'a', 'missing'], count: 2 });
  assert.equal(store.runtime.partyDraw, undefined);
});
test('пауза DJ сохраняет позицию, громкость ограничена, общий стоп выключает оба источника', () => {
  reset(); send('dj', { src: 'media/test.mp3', playing: true, volume: 12 });
  store.runtime.dj.startedAt -= 5000;
  send('dj', { playing: false });
  assert.ok(store.runtime.dj.position >= 5);
  assert.equal(store.runtime.dj.volume, 1);
  send('dj', { playing: true });
  send('partySilence', {});
  assert.equal(store.runtime.dj.playing, false);
  assert.equal(store.runtime.music.on, false);
  assert.equal(store.runtime.silenceSeq, 1);
});
test('альбом продолжает с текущего кадра после паузы и закрывается без навигации', () => {
  reset(); const screen = store.runtime.screen;
  send('album', { frames: ['a', 'b', 'c'].map(x => ({ src: `media/${x}.jpg` })), seconds: 3, open: true, playing: true });
  store.runtime.album.startedAt -= 6100;
  send('album', { playing: false });
  assert.equal(store.runtime.album.index, 2);
  send('album', { delta: 1 }); assert.equal(store.runtime.album.index, 0);
  send('album', { open: false });
  assert.equal(store.runtime.screen, screen);
  assert.equal(store.runtime.album.playing, false);
});
test('внешние ссылки и пустые альбомы не запускаются', () => {
  reset(); send('dj', { src: 'https://example.com/track.mp3', playing: true });
  assert.equal(store.runtime.dj, undefined);
  send('album', { frames: [{ src: 'https://example.com/image.jpg' }], open: true, playing: true });
  assert.equal(store.runtime.album.open, false);
});
test('старый фон и DJ не играют одновременно', () => {
  reset(); send('dj', { src: 'media/test.mp3', playing: true });
  store.runtime.dj.startedAt -= 2000;
  send('music', { on: true });
  assert.equal(store.runtime.dj.playing, false);
  assert.ok(store.runtime.dj.position >= 2);
  send('dj', { playing: true });
  assert.equal(store.runtime.music.on, false);
});
test('перезапуск не запускает медиа, но сохраняет историю участников', () => {
  reset(); store.guests.list = [{ id: 'a', name: 'Аня' }];
  send('partyDraw', { ids: ['a'], count: 1 });
  send('dj', { src: 'media/test.mp3', playing: true });
  send('album', { frames: [{ src: 'media/a.jpg' }], open: true, playing: true });
  store.flush(); store.load();
  assert.equal(store.runtime.dj.playing, false);
  assert.equal(store.runtime.album.open, false);
  assert.equal(store.runtime.partyDraw.open, false);
  assert.deepEqual(store.runtime.partyDraw.used, ['a']);
});
