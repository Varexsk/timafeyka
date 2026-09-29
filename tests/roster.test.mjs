import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.CIRK_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-roster-'));
const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');
const { rosterPage } = await import('../public/js/roster.js');

test('25 гостей: циклическое перелистывание и переход к получателю баллов', () => {
  store.resetToSeed();
  store.show.mode = 'guests';
  store.guests.list = Array.from({ length: 25 }, (_, i) => ({ id: 'guest-' + i, name: 'Гость ' + i, score: 0 }));
  applyCommand('rosterPage', { delta: -1 });
  const snapshot = () => ({ runtime: store.runtime, show: store.show, guests: store.guests.list });
  assert.equal(rosterPage(snapshot()).list.length, 1);
  applyCommand('rosterPage', { delta: 1 });
  assert.equal(store.runtime.rosterPage, 0);
  assert.equal(rosterPage(snapshot()).list.length, 6);
  applyCommand('award', { id: 'guest-24', delta: 1 });
  assert.equal(store.runtime.rosterPage, 4);
  assert.equal(rosterPage(snapshot()).list[0].score, 1);
});

test('после переключения на шесть семей устаревшая страница ограничивается', () => {
  store.resetToSeed();
  store.show.mode = 'teams';
  store.guests.teams = Array.from({ length: 6 }, (_, i) => ({ id: 'team-' + i }));
  store.runtime.rosterPage = 4;
  const snapshot = { runtime: store.runtime, show: store.show, teams: store.guests.teams };
  assert.equal(rosterPage(snapshot).list.length, 6);
  applyCommand('rosterPage', { delta: 1 });
  assert.equal(store.runtime.rosterPage, 0);
});
