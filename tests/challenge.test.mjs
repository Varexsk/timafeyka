// Цирковые фанты: колесо само выбирает артиста, ведущий судит, отказавшегося
// можно перевыбрать. И смена семьи с телефона, если промахнулись карточкой.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-challenge-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

const send = (type, payload) => applyCommand(type, payload || {});
const r = () => store.runtime;
const slice = () => ((r().rounds || {})[r().contestId + '/' + r().itemId] || {}).slice || {};
const teamScore = (id) => (store.guests.teams.find((t) => t.id === id) || {}).score || 0;

function reset() {
  store.load();
  store.resetToSeed();
  const [a, b] = store.guests.teams;
  store.guests.list = [
    { id: 'g1', name: 'Нина', teamId: a.id, score: 0 },
    { id: 'g2', name: 'Валя', teamId: a.id, score: 0 },
    { id: 'g3', name: 'Коля', teamId: b.id, score: 0 },
    { id: 'g4', name: 'Болельщик', teamId: b.id, score: 0, playing: false }
  ];
  return [a, b];
}

function onChallenge(itemIndex = 0) {
  const c = store.show.contests.find((x) => x.type === 'challenge');
  send('goto', { contestId: c.id, itemId: c.items[itemIndex].id, phase: 'question' });
  return c;
}

test('задание открылось — колесо крутится само и выбирает играющего', () => {
  reset();
  onChallenge();
  assert.equal(r().partyDraw.open, true, 'колесо на экране');
  assert.ok(r().partyDraw.closeAt > r().partyDraw.endsAt, 'и само уйдёт после остановки');
  const who = slice().who;
  assert.ok(['g1', 'g2', 'g3'].includes(who), 'болельщика колесо не зовёт');
  assert.equal(slice().drawSeq, r().partyDraw.seq);
});

test('«Дальше» тоже крутит колесо, а возврат к заданию — нет', () => {
  reset();
  const c = store.show.contests.find((x) => x.type === 'challenge');
  send('goto', { contestId: c.id, phase: 'intro' });
  assert.equal(slice().who, undefined);
  send('next');
  const first = slice().who;
  assert.ok(first);
  const seq = r().partyDraw.seq;
  send('next');                                   // к итогу задания
  send('prev');                                   // и обратно
  assert.equal(slice().who, first, 'артист тот же');
  assert.equal(r().partyDraw.seq, seq, 'колесо заново не крутилось');
});

test('следующее задание зовёт того, кто ещё не выступал', () => {
  reset();
  onChallenge(0);
  const one = slice().who;
  onChallenge(1);
  const two = slice().who;
  onChallenge(2);
  const three = slice().who;
  assert.equal(new Set([one, two, three]).size, 3);
  onChallenge(3);
  assert.ok(slice().who, 'вышли все — новый круг, а не отказ');
});

test('справился — балл семье артиста, передумал — балл снимается', () => {
  reset();
  onChallenge();
  const guest = store.guests.list.find((g) => g.id === slice().who);
  send('roundJudge', { result: 'pass' });
  assert.equal(teamScore(guest.teamId), 1);
  send('roundJudge', { result: 'pass' });
  assert.equal(teamScore(guest.teamId), 1, 'второе нажатие балл не удваивает');
  send('roundJudge', { result: 'fail' });
  assert.equal(teamScore(guest.teamId), 0);
  assert.equal(slice().result, 'fail');
});

test('отказался — колесо крутится без него, и балл за него не остаётся', () => {
  reset();
  onChallenge();
  const first = slice().who;
  const team = store.guests.list.find((g) => g.id === first).teamId;
  send('roundJudge', { result: 'pass' });
  send('roundRedraw', { refused: true });
  assert.notEqual(slice().who, first);
  assert.deepEqual(slice().refused, [first]);
  assert.equal(slice().result, '');
  assert.equal(teamScore(team), 0, 'балл отказавшегося снят');

  send('roundRedraw', { refused: true });
  send('roundRedraw', { refused: true });
  const out = send('roundRedraw', { refused: true });
  assert.equal(out.ok, false, 'все отказались — звать некого');
});

test('без артиста судить нечего', () => {
  reset();
  store.guests.list.forEach((g) => { g.playing = false; });
  onChallenge();
  assert.equal(slice().who, undefined);
  assert.equal(send('roundJudge', { result: 'pass' }).ok, false);
});

test('смена семьи с телефона снимает его ответ с прежней семьи', () => {
  const [a] = reset();
  const quiz = store.show.contests.find((c) => c.type === 'quiz');
  send('goto', { contestId: quiz.id, itemId: quiz.items[0].id, phase: 'question' });
  send('join', { playerId: 'p1', ownerId: a.id });
  send('join', { playerId: 'p2', ownerId: a.id });
  send('vote', { ownerId: a.id, playerId: 'p1', value: 0 });
  send('vote', { ownerId: a.id, playerId: 'p2', value: 1 });

  send('leave', { playerId: 'p2', forget: true });
  const vote = r().rounds[quiz.id + '/' + quiz.items[0].id].votes[a.id];
  assert.deepEqual(Object.keys(vote.by), ['p1']);
  assert.equal(vote.v, 0, 'ответ семьи пересчитан');

  // Просто закрытая вкладка ответ не трогает.
  send('leave', { playerId: 'p1' });
  assert.ok(r().rounds[quiz.id + '/' + quiz.items[0].id].votes[a.id]);
});

test.after(() => {
  store.flush();
  fs.rmSync(TMP, { recursive: true, force: true });
});
