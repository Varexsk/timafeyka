// Ответ семьи, когда её участники отвечают с разных телефонов.
//
// Раньше ответы хранились по семье: каждый следующий телефон затирал
// предыдущий, и в зачёт шёл тот, кто нажал позже всех. Четыре бабушки из семьи
// «Бабушки» назвали три разных числа — семья получала последнее, а ведущий
// даже не видел, что внутри был спор.
//
// Теперь сервер помнит ответ каждого телефона и сводит их в один ответ семьи:
// числа — среднее, варианты — большинство, текст — последний.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-family-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');
const { playRuntime } = await import('../server/project.js');

const send = (type, payload) => applyCommand(type, payload || {});
const roundNow = () => {
  const r = store.runtime;
  return (r.rounds || {})[r.contestId + '/' + r.itemId] || null;
};
const familyVote = (id) => (roundNow().votes[id] || {}).v;

function reset() {
  store.load();
  store.resetToSeed();
  return store.guests.teams;
}

// Встаём на первый вопрос «Ставок» с известным правильным числом.
function onBets(value) {
  const contest = store.show.contests.find((c) => c.id === 'c-bets');
  const copy = JSON.parse(JSON.stringify(contest));
  copy.items[0].value = value;
  send('saveContest', { contest: copy });
  send('goto', { contestId: 'c-bets', itemId: copy.items[0].id, phase: 'question' });
  return copy;
}

// …и на первый вопрос викторины — там ответ выбирается из вариантов.
function onQuiz() {
  const contest = store.show.contests.find((c) => c.id === 'c-quiz');
  send('goto', { contestId: 'c-quiz', itemId: contest.items[0].id, phase: 'question' });
  return contest;
}

test('числа сводятся в среднее по семье', () => {
  const [a] = reset();
  onBets(3250);

  send('vote', { ownerId: a.id, playerId: 'p-nina', value: '3200' });
  send('vote', { ownerId: a.id, playerId: 'p-valya', value: '3300' });
  send('vote', { ownerId: a.id, playerId: 'p-lyuba', value: '3250' });

  assert.equal(familyVote(a.id), 3250);
  // Ответ каждого сохранён — ведущему есть что показать при споре.
  assert.deepEqual(Object.keys(roundNow().votes[a.id].by), ['p-nina', 'p-valya', 'p-lyuba']);
});

test('участник меняет свой ответ, а не добавляет второй', () => {
  const [a] = reset();
  onBets(3250);

  send('vote', { ownerId: a.id, playerId: 'p-nina', value: '3000' });
  send('vote', { ownerId: a.id, playerId: 'p-valya', value: '4000' });
  assert.equal(familyVote(a.id), 3500);

  send('vote', { ownerId: a.id, playerId: 'p-nina', value: '2000' });
  assert.equal(Object.keys(roundNow().votes[a.id].by).length, 2);
  assert.equal(familyVote(a.id), 3000);
});

test('участник забирает ответ, среднее пересчитывается', () => {
  const [a] = reset();
  onBets(3250);

  send('vote', { ownerId: a.id, playerId: 'p-nina', value: '3000' });
  send('vote', { ownerId: a.id, playerId: 'p-valya', value: '4000' });
  send('vote', { ownerId: a.id, playerId: 'p-valya', value: '' });
  assert.equal(familyVote(a.id), 3000);

  // Ушёл последний — семья снова считается не ответившей.
  send('vote', { ownerId: a.id, playerId: 'p-nina', value: '' });
  assert.equal(roundNow().votes[a.id], undefined);
});

test('балл ближайшему считается по сведённому числу семьи', () => {
  const [a, b] = reset();
  onBets(3250);

  // Семья «а» вразнобой, но в среднем точно; семья «б» одним голосом мимо.
  send('vote', { ownerId: a.id, playerId: 'p1', value: '3000' });
  send('vote', { ownerId: a.id, playerId: 'p2', value: '3500' });
  send('vote', { ownerId: b.id, playerId: 'p3', value: '3100' });

  send('reveal', {});
  const winner = store.guests.teams.find((t) => t.id === a.id);
  assert.equal(winner.score, 1, 'балл ушёл семье со средним 3250');
  assert.equal(store.guests.teams.find((t) => t.id === b.id).score, 0);
});

test('варианты сводятся большинством', () => {
  const [a] = reset();
  onQuiz();

  send('vote', { ownerId: a.id, playerId: 'p1', value: 2 });
  send('vote', { ownerId: a.id, playerId: 'p2', value: 2 });
  send('vote', { ownerId: a.id, playerId: 'p3', value: 0 });

  assert.equal(familyVote(a.id), 2, 'двое против одного');
});

test('при ничьей в вариантах побеждает ответ, отданный последним', () => {
  const [a] = reset();
  onQuiz();

  send('vote', { ownerId: a.id, playerId: 'p1', value: 1 });
  send('vote', { ownerId: a.id, playerId: 'p2', value: 3 });
  assert.equal(familyVote(a.id), 3, 'семья передумала последней');

  // И наоборот: голос за первый вариант приходит последним.
  send('vote', { ownerId: a.id, playerId: 'p2', value: 3 });
  send('vote', { ownerId: a.id, playerId: 'p1', value: 1 });
  assert.equal(familyVote(a.id), 1);
});

test('ведущий с пульта отвечает за всю семью и перебивает телефоны', () => {
  const [a] = reset();
  onBets(3250);

  send('vote', { ownerId: a.id, playerId: 'p1', value: '3000' });
  send('vote', { ownerId: a.id, playerId: 'p2', value: '4000' });
  send('vote', { ownerId: a.id, value: '3250' });

  assert.equal(familyVote(a.id), 3250);
  assert.equal(roundNow().votes[a.id].by, undefined, 'поимённых ответов больше нет');

  // И дальше ответ семьи снова собирается с телефонов, с чистого листа.
  send('vote', { ownerId: a.id, playerId: 'p1', value: '1000' });
  assert.equal(familyVote(a.id), 1000);
});

test('гость видит ответы своей семьи и не видит чужие', () => {
  const [a, b] = reset();
  onBets(3250);

  send('vote', { ownerId: a.id, playerId: 'p1', value: '3000' });
  send('vote', { ownerId: a.id, playerId: 'p2', value: '3500' });
  send('vote', { ownerId: b.id, playerId: 'p3', value: '9999' });

  const mine = playRuntime(store.runtime, a.id, store.show);
  assert.equal(mine.round.mine, 3250);
  assert.deepEqual(Object.keys(mine.round.family), ['p1', 'p2']);
  assert.equal(mine.round.votes, undefined, 'до раскрытия чужих ответов не видно');

  send('reveal', {});
  const after = playRuntime(store.runtime, a.id, store.show);
  assert.ok(after.round.votes[b.id], 'после раскрытия видно всех');
});
