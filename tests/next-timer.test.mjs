// «Номер на арене»: первое «Дальше» на задании запускает время.
//
// Раньше таймер запускала только отдельная кнопка на пульте, а «Дальше»
// молча переводило задание в «ответ», где у физического номера ничего не
// меняется: ведущий жал — и ничего не происходило.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-next-timer-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

const send = (type, payload) => applyCommand(type, payload || {});
const r = () => store.runtime;

function onTask(item) {
  store.load();
  store.resetToSeed();
  store.show.contests.push({
    id: 'c-arena', type: 'physical', enabled: true, title: 'Запеленай на скорость',
    items: [{ id: 'i-1', q: 'Задание', seconds: 60, judge: 'pass', ...item }, { id: 'i-2', q: 'Ещё', seconds: 30, judge: 'pass' }]
  });
  send('goto', { contestId: 'c-arena', itemId: 'i-1', phase: 'question' });
}

test('первое «Дальше» запускает таймер задания, фаза остаётся', () => {
  onTask();
  send('next');
  assert.equal(r().phase, 'question');
  assert.ok(r().timer && r().timer.running, 'время пошло');
  assert.equal(r().timer.seconds, 60);
  assert.equal(r().timer.itemId, 'i-1');
});

test('второе «Дальше» — к итогу, третье — к следующему заданию', () => {
  onTask();
  send('next');
  send('next');
  assert.equal(r().phase, 'reveal');
  send('next');
  assert.equal(r().itemId, 'i-2');
  assert.equal(r().phase, 'question');
});

test('таймер уже запущен кнопкой — «Дальше» ведёт к итогу', () => {
  onTask();
  send('timerStart', { seconds: 60 });
  send('next');
  assert.equal(r().phase, 'reveal');
});

test('у дуэли и двух пар свой старт — «Дальше» таймер не запускает', () => {
  for (const judge of ['race', 'pairs']) {
    onTask({ judge });
    send('next');
    assert.equal(r().phase, 'reveal', judge);
    assert.ok(!r().timer || r().timer.itemId !== 'i-1', judge);
  }
});

test('без секунд — «Дальше» ведёт к итогу', () => {
  onTask({ seconds: 0 });
  send('next');
  assert.equal(r().phase, 'reveal');
});
