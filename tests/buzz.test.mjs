// Жужжалка: кто нажал первым.
//
// «Кто первый» решает сервер по времени прихода команды с поправкой на пинг.
// Проверяем именно правила очереди — они и есть вся честность этой затеи.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-buzz-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

const send = (type, payload) => applyCommand(type, payload || {});
const round = () => {
  const r = store.runtime;
  return (r.rounds || {})[r.contestId + '/' + r.itemId] || null;
};
const queue = () => ((round() && round().buzz && round().buzz.order) || []).map((x) => x.ownerId);
const scoreOf = (id) => (store.guests.teams.find((o) => o.id === id) || {}).score;

function onQuestion() {
  store.load();
  store.resetToSeed();
  const quiz = store.show.contests.find((c) => c.id === 'c-quiz');
  send('goto', { contestId: quiz.id, itemId: quiz.items[0].id, phase: 'question' });
  // Телефоны привязываем к семьям.
  const teams = store.guests.teams;
  teams.forEach((t, i) => send('join', { playerId: 'p' + i, ownerId: t.id }));
  return teams;
}

test('до сигнала нажатие — фальстарт, а не место в очереди', () => {
  const [a] = onQuestion();
  send('buzz', { playerId: 'p0' });

  assert.deepEqual(queue(), [], 'в очередь не попал');
  assert.ok(round().buzz.falseStart[a.id] > Date.now(), 'и отбывает паузу');
});

test('после сигнала очередь выстраивается по времени нажатия', () => {
  const [a, b, c] = onQuestion();
  send('armBuzz', { on: true });

  send('buzz', { playerId: 'p1' });
  send('buzz', { playerId: 'p2' });
  send('buzz', { playerId: 'p0' });

  assert.deepEqual(queue(), [b.id, c.id, a.id]);
});

test('второй телефон той же семьи очередь не меняет', () => {
  const [a, b] = onQuestion();
  send('join', { playerId: 'p-second', ownerId: a.id });
  send('armBuzz', { on: true });

  send('buzz', { playerId: 'p0' });
  send('buzz', { playerId: 'p-second' });
  send('buzz', { playerId: 'p1' });

  assert.deepEqual(queue(), [a.id, b.id], 'семья в очереди одна');
});

test('приписанная себе задержка не помогает выиграть', () => {
  const [a, b] = onQuestion();
  send('armBuzz', { on: true });

  // Первым нажал b, но a заявляет огромный пинг, чтобы «отмотать» время назад.
  send('buzz', { playerId: 'p1', rtt: 0 });
  send('buzz', { playerId: 'p0', rtt: 100000 });

  const order = round().buzz.order;
  const gap = order.find((x) => x.ownerId === a.id).at - order.find((x) => x.ownerId === b.id).at;
  assert.ok(gap > -160, 'поправка ограничена половиной от 300 мс, а не выдумкой телефона');
});

test('«Верно» даёт балл первому и закрывает жужжалку', () => {
  const [a, b] = onQuestion();
  send('armBuzz', { on: true });
  send('buzz', { playerId: 'p1' });
  send('buzz', { playerId: 'p0' });

  send('buzzCorrect');

  assert.equal(scoreOf(b.id), 1);
  assert.equal(scoreOf(a.id), 0);
  assert.equal(round().buzz.open, false);
  assert.equal(round().buzz.locked, true);
});

test('«Мимо» передаёт очередь следующему', () => {
  const [a, b] = onQuestion();
  send('armBuzz', { on: true });
  send('buzz', { playerId: 'p1' });
  send('buzz', { playerId: 'p0' });
  assert.deepEqual(queue(), [b.id, a.id]);

  send('buzzMiss');
  assert.deepEqual(queue(), [a.id]);

  send('buzzCorrect');
  assert.equal(scoreOf(a.id), 1, 'балл ушёл второму');
});

test('после закрытия нажатие снова считается фальстартом', () => {
  const [a, b] = onQuestion();
  send('armBuzz', { on: true });
  send('buzz', { playerId: 'p1' });
  send('buzzCorrect');

  send('buzz', { playerId: 'p0' });
  assert.deepEqual(queue(), [b.id], 'очередь не выросла');
  assert.ok(round().buzz.falseStart[a.id] > Date.now());
});

test('новый сигнал очищает прошлую очередь', () => {
  const [a, b] = onQuestion();
  send('armBuzz', { on: true });
  send('buzz', { playerId: 'p0' });
  send('armBuzz', { on: true });

  assert.deepEqual(queue(), []);
  send('buzz', { playerId: 'p1' });
  assert.deepEqual(queue(), [b.id]);
  assert.ok(a);
});

test('«переиграть вопрос» убирает и жужжалку', () => {
  onQuestion();
  send('armBuzz', { on: true });
  send('buzz', { playerId: 'p0' });

  send('resetRound');
  assert.deepEqual(queue(), []);
  assert.equal(round().buzz.open, false);
});

test('телефон не узнаёт чужих ответов, но видит очередь', async () => {
  const { playRuntime } = (await import('../server/project.js')).default;
  const [a, b] = onQuestion();
  send('armBuzz', { on: true });
  send('buzz', { playerId: 'p0' });
  send('buzz', { playerId: 'p1' });
  send('vote', { ownerId: b.id, value: 3 });

  const out = playRuntime(store.runtime, a.id, store.show);
  assert.deepEqual(out.round.buzz.order.map((x) => x.ownerId), [a.id, b.id]);
  assert.equal(out.round.votes, undefined, 'чужой ответ по-прежнему не виден');
});

test.after(async () => {
  // Окно честности замораживает очередь отложенно — дадим ему отработать,
  // иначе он попробует записать состояние в уже удалённую папку.
  await new Promise((r) => setTimeout(r, BUZZ_WINDOW_WAIT));
  store.flush();
  fs.rmSync(TMP, { recursive: true, force: true });
});

const BUZZ_WINDOW_WAIT = 250;
