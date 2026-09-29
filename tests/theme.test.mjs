// Музыка номера: своя тема у конкурса включается сама.
//
// Раньше трек к конкурсу можно было только выбрать руками на DJ-пульте — ровно
// в тот момент, когда ведущий объявляет номер и ему меньше всего до этого дела.
// Теперь у конкурса есть поле «Музыка номера»: тема заводится с афишей,
// приглушается на вопросах и замолкает, когда номер закончился.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-theme-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

const send = (type, payload) => applyCommand(type, payload || {});
const dj = () => store.runtime.dj || {};

const TRACK = '/media/music/parad.mp3';
const OTHER = '/media/music/valse.mp3';

// Вешаем тему на первый конкурс программы и возвращаем оба соседних номера.
function reset({ themeMusic } = {}) {
  store.load();
  store.resetToSeed();
  if (themeMusic) send('directorSettings', { themeMusic });

  const enabled = store.show.contests.filter((c) => c.enabled !== false);
  const copy = JSON.parse(JSON.stringify(enabled[0]));
  copy.themeTrack = TRACK;
  send('saveContest', { contest: copy });
  return [copy, enabled[1]];
}

test('афиша номера сама заводит его тему', () => {
  const [first] = reset();
  send('goto', { contestId: first.id, phase: 'intro' });

  assert.equal(dj().src, TRACK);
  assert.equal(dj().playing, true);
  assert.equal(dj().loop, true, 'тема играет по кругу — номер длиннее трека');
  assert.equal(dj().volume, 0.3);
});

test('на вопросах тема приглушается, на афише снова громкая', () => {
  const [first] = reset();
  send('goto', { contestId: first.id, phase: 'intro' });
  send('next');

  assert.equal(store.runtime.phase, 'question');
  assert.equal(dj().volume, 0.12, 'ведущего должно быть слышно');
  assert.equal(dj().src, TRACK, 'трек тот же, сменилась только громкость');

  send('prev');
  assert.equal(store.runtime.phase, 'intro');
  assert.equal(dj().volume, 0.3);
});

test('следующий номер без своей темы — музыка смолкает', () => {
  const [first, second] = reset();
  send('goto', { contestId: first.id, phase: 'intro' });
  assert.equal(dj().playing, true);

  send('goto', { contestId: second.id, phase: 'intro' });
  assert.equal(dj().playing, false, 'чужая тема не тянется в следующий номер');
});

test('ведущий сам выбрал трек — до конца номера музыка его', () => {
  const [first] = reset();
  send('goto', { contestId: first.id, phase: 'intro' });

  send('dj', { src: OTHER, playing: true, volume: 0.5 });
  send('next');
  assert.equal(dj().src, OTHER, 'навигация не перебивает выбор ведущего');
  assert.equal(dj().volume, 0.5, 'и не трогает его громкость');

  send('next');
  assert.equal(dj().src, OTHER);
});

test('со следующего номера тема снова слушается программы', () => {
  const [first, second] = reset();
  send('goto', { contestId: second.id, phase: 'intro' });
  send('dj', { src: OTHER, playing: true });

  send('goto', { contestId: first.id, phase: 'intro' });
  assert.equal(dj().src, TRACK, 'новый номер приносит свою тему');
  assert.equal(dj().playing, true);
});

test('тему можно выключить целиком — тогда музыка только вручную', () => {
  const [first] = reset({ themeMusic: 'off' });
  send('goto', { contestId: first.id, phase: 'intro' });

  assert.equal(dj().src, undefined, 'сервер не трогал DJ-пульт');
  assert.equal(store.show.director.themeMusic, 'off');
});

test('на антракте тема не вмешивается', () => {
  const [first] = reset();
  send('intermission', { on: true });
  send('goto', { contestId: first.id, phase: 'intro' });

  assert.notEqual(dj().src, TRACK, 'антракт остаётся антрактом');
});
