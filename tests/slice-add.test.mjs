// Счётчик в кармане вопроса прибавляет сервер. Ведущий жмёт «+1» быстро
// и подряд — ни одно нажатие не должно потеряться.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-slice-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

const send = (type, payload) => applyCommand(type, payload || {});

function slice() {
  const r = store.runtime;
  return ((r.rounds || {})[r.contestId + '/' + r.itemId] || {}).slice || {};
}

function onQuestion() {
  store.load();
  store.resetToSeed();
  const contest = store.show.contests.find((c) => c.enabled !== false && (c.items || []).length);
  send('goto', { contestId: contest.id, itemId: contest.items[0].id, phase: 'question' });
}

test('десять «+1» подряд — ровно десять', () => {
  onQuestion();
  for (let i = 0; i < 10; i++) send('sliceAdd', { key: 'c_t1', delta: 1 });
  assert.equal(slice().c_t1, 10);
});

test('ниже нуля счёт не уходит', () => {
  onQuestion();
  send('sliceAdd', { key: 'c_t1', delta: -1 });
  assert.equal(slice().c_t1, 0);
});

test('странные имена ключей не принимаются', () => {
  onQuestion();
  send('sliceAdd', { key: '__proto__.x', delta: 1 });
  assert.equal(Object.keys(slice()).length, 0);
});
