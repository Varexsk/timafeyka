// Играющий состав семьи.
//
// В семье «Бабушки» четверо, а к конкурсам выходят двое: остальные сидят за
// столом и болеют. Раньше такого различия не было — колесо вызывало на арену
// любого, кто вписан в список гостей.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-playing-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

const send = (type, payload) => applyCommand(type, payload || {});
const guest = (id) => store.guests.list.find((g) => g.id === id);

function reset() {
  store.load();
  store.resetToSeed();
  return store.guests.list;
}

test('по умолчанию играют все — старые списки гостей не ломаются', () => {
  const list = reset();
  assert.ok(list.length, 'в заготовке есть гости');
  assert.ok(list.every((g) => g.playing === undefined), 'отметки нет, и это значит «играет»');
});

test('гостя можно снять с конкурсов и вернуть обратно', () => {
  const [g] = reset();
  send('updateGuest', { id: g.id, playing: false });
  assert.equal(guest(g.id).playing, false);

  send('updateGuest', { id: g.id, playing: true });
  assert.equal(guest(g.id).playing, true);
});

test('колесо без явного списка вызывает только играющих', () => {
  const list = reset();
  for (const g of list.slice(1)) send('updateGuest', { id: g.id, playing: false });

  send('directorCue', { kind: 'entrance' });
  const draw = store.runtime.partyDraw;
  assert.ok(draw && draw.open, 'колесо крутится');
  assert.deepEqual(draw.picks.map((p) => p.id), [list[0].id], 'на арену вышел единственный играющий');
});

test('если играющих не хватает, колесо честно отказывается', () => {
  const list = reset();
  for (const g of list) send('updateGuest', { id: g.id, playing: false });

  const result = send('directorCue', { kind: 'entrance' });
  assert.equal(result.ok, false);
  assert.match(result.error, /участник/i);
});

test('ведущий может вызвать болельщика, назвав его прямо', () => {
  const list = reset();
  send('updateGuest', { id: list[0].id, playing: false });

  send('directorCue', { kind: 'entrance', ids: [list[0].id] });
  assert.deepEqual(store.runtime.partyDraw.picks.map((p) => p.id), [list[0].id]);
});

test('отметка переживает перезапуск сервера', () => {
  const [g] = reset();
  send('updateGuest', { id: g.id, playing: false });

  // Запись на диск отложена на треть секунды — торопим её.
  store.flush();
  store.load();
  assert.equal(guest(g.id).playing, false);
});
