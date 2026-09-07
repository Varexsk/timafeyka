// Баллы и отмена начисления.
//
// Раньше отменить промах можно было только минусами — и неточно: счёт не уходит
// ниже нуля, поэтому «минус три» после «плюс один» съедал лишнее. Теперь в
// журнал пишется ровно та дельта, которая применилась.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-score-'));
process.env.CIRK_DATA = TMP;

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');
const { pointsOf } = await import('../public/js/util.js');

function reset() {
  store.load();
  store.resetToSeed();
  return store.guests.teams[0];
}
const send = (type, payload) => applyCommand(type, payload || {});
const scoreOf = (id) => (store.guests.teams.concat(store.guests.list).find((o) => o.id === id) || {}).score;
const log = () => store.runtime.awardLog || [];

test('начисление попадает в журнал', () => {
  const team = reset();
  send('award', { id: team.id, delta: 2 });

  assert.equal(scoreOf(team.id), 2);
  assert.equal(log().length, 1);
  assert.deepEqual(log()[0].entries, [{ id: team.id, delta: 2 }]);
});

test('отмена возвращает счёт ровно как было', () => {
  const team = reset();
  send('award', { id: team.id, delta: 3 });
  send('award', { id: team.id, delta: 2 });
  assert.equal(scoreOf(team.id), 5);

  send('undo');
  assert.equal(scoreOf(team.id), 3, 'откатили только последнее начисление');
  send('undo');
  assert.equal(scoreOf(team.id), 0);

  // Отменять больше нечего — счёт не должен уйти в минус.
  send('undo');
  assert.equal(scoreOf(team.id), 0);
});

test('счёт не уходит ниже нуля, и отмена это учитывает', () => {
  const team = reset();
  send('award', { id: team.id, delta: 1 });
  send('award', { id: team.id, delta: -5 });

  assert.equal(scoreOf(team.id), 0);
  // В журнал записалась реально применённая дельта, а не запрошенная.
  assert.deepEqual(log()[1].entries, [{ id: team.id, delta: -1 }]);

  send('undo');
  assert.equal(scoreOf(team.id), 1, 'вернулись к единице, а не к минус четырём');
});

test('начисление нескольким сразу отменяется целиком', () => {
  reset();
  const [a, b] = store.guests.teams;
  // Так будет при ничьей: балл получают оба.
  applyCommand('award', { id: a.id, delta: 1 });
  applyCommand('award', { id: b.id, delta: 1 });
  assert.equal(scoreOf(a.id), 1);
  assert.equal(scoreOf(b.id), 1);

  send('undo');
  assert.equal(scoreOf(b.id), 0);
  assert.equal(scoreOf(a.id), 1);
});

test('отмена по номеру записи', () => {
  const team = reset();
  send('award', { id: team.id, delta: 4 });
  const seq = log()[0].seq;
  send('award', { id: team.id, delta: 1 });

  send('undoAward', { seq });
  assert.equal(scoreOf(team.id), 1, 'убрали именно первое начисление');
  assert.equal(log()[0].undone, true);
});

test('обнуление баллов чистит журнал', () => {
  const team = reset();
  send('award', { id: team.id, delta: 3 });
  send('resetScores');

  assert.equal(scoreOf(team.id), 0);
  assert.equal(log().length, 0);
  send('undo');
  assert.equal(scoreOf(team.id), 0, 'после обнуления отменять нечего');
});

test('нулевое начисление не засоряет журнал', () => {
  const team = reset();
  send('award', { id: team.id, delta: 0 });
  assert.equal(log().length, 0);
});

test('журнал не растёт бесконечно', () => {
  const team = reset();
  for (let i = 0; i < 30; i++) send('award', { id: team.id, delta: 1 });
  assert.equal(log().length, 20);
});

test('баллы за верный ответ берутся из конкурса и множителя', () => {
  assert.equal(pointsOf({ pointsPerCorrect: 1 }), 1);
  assert.equal(pointsOf({ pointsPerCorrect: 2 }), 2);
  assert.equal(pointsOf({ pointsPerCorrect: 2, multiplier: 2 }), 4, 'ва-банк удваивает');
  assert.equal(pointsOf({}), 1, 'без настройки — один балл');
  assert.equal(pointsOf(null), 1);
  assert.equal(pointsOf({ pointsPerCorrect: 0 }), 1, 'ноль трактуем как «не задано»');
});

test.after(() => {
  store.flush();
  fs.rmSync(TMP, { recursive: true, force: true });
});
