// Личный зачёт, скорость, джокеры, фотобудка и летопись праздника.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-extras-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');
const { playRuntime } = await import('../server/project.js');

const send = (type, payload) => applyCommand(type, payload || {});
const scoreOf = (id) => (store.guests.teams.find((t) => t.id === id) || {}).score || 0;
const roundNow = () => {
  const r = store.runtime;
  return (r.rounds || {})[r.contestId + '/' + r.itemId] || null;
};

function reset() {
  store.load();
  store.resetToSeed();
  return store.guests.teams;
}

// Ставим викторину на вопрос с известным верным вариантом.
function onQuiz({ answer = 1, options = 4, speedBonus = false } = {}) {
  const contest = store.show.contests.find((c) => c.id === 'c-quiz');
  const copy = JSON.parse(JSON.stringify(contest));
  copy.speedBonus = speedBonus;
  copy.pointsPerCorrect = 1;
  copy.multiplier = 1;
  copy.items[0].answer = answer;
  copy.items[0].options = Array.from({ length: options }, (_, i) => ({ text: 'вариант ' + i, icon: '' }));
  send('saveContest', { contest: copy });
  send('goto', { contestId: copy.id, itemId: copy.items[0].id, phase: 'question' });
  return copy;
}

test('каждый сам за себя: семья получает балл по доле угадавших', () => {
  const [a, b] = reset();
  send('setAnswerMode', { mode: 'each' });
  onQuiz({ answer: 1 });

  // Семья «а»: двое из двух. Семья «б»: двое из четырёх.
  send('vote', { ownerId: a.id, playerId: 'a1', value: 1 });
  send('vote', { ownerId: a.id, playerId: 'a2', value: 1 });
  for (const [p, v] of [['b1', 1], ['b2', 1], ['b3', 0], ['b4', 2]]) {
    send('vote', { ownerId: b.id, playerId: p, value: v });
  }

  send('reveal', {});
  assert.equal(scoreOf(a.id), 1, 'угадали все — полный балл');
  assert.equal(scoreOf(b.id), 0.5, 'угадала половина — половина балла');
});

test('большая семья не выигрывает одним числом телефонов', () => {
  const [a, b] = reset();
  send('setAnswerMode', { mode: 'each' });
  onQuiz({ answer: 1 });

  send('vote', { ownerId: a.id, playerId: 'a1', value: 1 });
  for (let i = 0; i < 6; i++) send('vote', { ownerId: b.id, playerId: 'b' + i, value: 1 });

  send('reveal', {});
  assert.equal(scoreOf(a.id), scoreOf(b.id), 'оба угадали полностью — баллы равны');
});

test('в обычном режиме семья по-прежнему отвечает одним голосом', () => {
  const [a] = reset();
  onQuiz({ answer: 1 });

  send('vote', { ownerId: a.id, playerId: 'a1', value: 1 });
  send('vote', { ownerId: a.id, playerId: 'a2', value: 0 });
  send('vote', { ownerId: a.id, playerId: 'a3', value: 1 });

  send('reveal', {});
  assert.equal(scoreOf(a.id), 1, 'большинство угадало — полный балл семье');
});

test('самый быстрый верный ответ приносит лишний балл', () => {
  const [a, b] = reset();
  onQuiz({ answer: 1, speedBonus: true });

  send('vote', { ownerId: b.id, playerId: 'b1', value: 1 });
  send('vote', { ownerId: a.id, playerId: 'a1', value: 1 });

  send('reveal', {});
  assert.equal(scoreOf(b.id), 2, 'ответили первыми: балл за верный плюс балл за скорость');
  assert.equal(scoreOf(a.id), 1, 'опоздавшие получают своё сполна');
  assert.equal(store.runtime.speed.ownerId, b.id);
});

test('без галочки скорость ничего не меняет', () => {
  const [a, b] = reset();
  onQuiz({ answer: 1, speedBonus: false });

  send('vote', { ownerId: b.id, playerId: 'b1', value: 1 });
  send('vote', { ownerId: a.id, playerId: 'a1', value: 1 });
  send('reveal', {});

  assert.equal(scoreOf(a.id), 1);
  assert.equal(scoreOf(b.id), 1);
});

test('«50 на 50» убирает два неверных варианта и только у своей семьи', () => {
  const [a, b] = reset();
  const contest = onQuiz({ answer: 1, options: 4 });

  const result = send('joker', { ownerId: a.id, kind: 'fifty' });
  assert.equal(result.ok, true);

  const hidden = roundNow().fifty[a.id];
  assert.equal(hidden.length, 2);
  assert.ok(!hidden.includes(1), 'правильный вариант остаётся');

  const mine = playRuntime(store.runtime, a.id, store.show);
  assert.deepEqual(mine.round.hidden, hidden);
  const theirs = playRuntime(store.runtime, b.id, store.show);
  assert.equal(theirs.round.hidden, undefined, 'чужой джокер соседям не помогает');
  assert.ok(contest.items[0].id);
});

test('джокер даётся один раз за вечер', () => {
  const [a] = reset();
  onQuiz({ answer: 1 });

  assert.equal(send('joker', { ownerId: a.id, kind: 'fifty' }).ok, true);
  const again = send('joker', { ownerId: a.id, kind: 'fifty' });
  assert.equal(again.ok, false);
  assert.match(again.error, /потрачен/i);

  // Второй джокер — отдельный, его ещё не тратили.
  assert.equal(send('joker', { ownerId: a.id, kind: 'audience' }).ok, true);
});

test('«помощь зала» показывает расклад голосов, но не ответ', () => {
  const [a, b] = reset();
  onQuiz({ answer: 1 });

  send('vote', { ownerId: a.id, playerId: 'a1', value: 1 });
  send('vote', { ownerId: b.id, playerId: 'b1', value: 0 });
  send('vote', { ownerId: b.id, playerId: 'b2', value: 0 });
  send('joker', { ownerId: a.id, kind: 'audience' });

  const view = playRuntime(store.runtime, a.id, store.show);
  assert.deepEqual(view.round.audience, { 0: 2, 1: 1 }, 'голоса считаются по людям');
  assert.equal(view.correct, undefined, 'правильный ответ по-прежнему не уходит на телефон');
});

test('джокер не работает вне вопроса', () => {
  const [a] = reset();
  onQuiz({ answer: 1 });
  send('reveal', {});

  const result = send('joker', { ownerId: a.id, kind: 'fifty' });
  assert.equal(result.ok, false);
});

test('летопись помнит вопросы и личный счёт, а репетиция — нет', () => {
  const [a] = reset();
  send('join', { playerId: 'a1', ownerId: a.id, guestId: store.guests.list.find((g) => g.teamId === a.id)?.id });
  const guestId = store.play.players.a1.guestId;
  assert.ok(guestId, 'телефон знает, кто за ним сидит');

  onQuiz({ answer: 1 });
  send('vote', { ownerId: a.id, playerId: 'a1', value: 1 });
  send('reveal', {});

  const stats = store.runtime.stats;
  assert.equal(stats.questions.length, 1);
  assert.equal(stats.people[guestId].right, 1);
  assert.equal(stats.people[guestId].total, 1);

  // Репетиция не должна попадать в историю праздника.
  send('rehearsal', { on: true });
  onQuiz({ answer: 1 });
  send('vote', { ownerId: a.id, playerId: 'a1', value: 1 });
  send('reveal', {});
  assert.equal(store.runtime.stats.questions.length, 1, 'прогон не дописал вопрос');
  send('rehearsal', { on: false });
});

test('фотография из фотобудки попадает в программу', () => {
  const [a] = reset();
  const guest = store.guests.list.find((g) => g.teamId === a.id);

  send('boothPhoto', { src: 'media/booth/abc.jpg', ownerId: a.id, guestId: guest.id });
  assert.equal(store.show.booth.length, 1);
  assert.equal(store.show.booth[0].by, guest.name);

  // Чужие пути в фотобудку не проходят.
  send('boothPhoto', { src: 'media/../secret.jpg', ownerId: a.id });
  send('boothPhoto', { src: '/etc/passwd', ownerId: a.id });
  assert.equal(store.show.booth.length, 1);

  send('removeBoothPhoto', { id: store.show.booth[0].id });
  assert.equal(store.show.booth.length, 0);
});

test('«повторить вопрос» не сбрасывает ответы', () => {
  const [a] = reset();
  onQuiz({ answer: 1 });
  send('vote', { ownerId: a.id, playerId: 'a1', value: 1 });

  send('repeatQuestion', {});
  assert.ok(store.runtime.repeat.seq > 0);
  assert.equal(store.runtime.repeat.q, store.show.contests.find((c) => c.id === 'c-quiz').items[0].q);
  assert.equal(roundNow().votes[a.id].v, 1, 'ответ на месте');
});

test('после диплома идёт экран «Как это было»', () => {
  reset();
  send('goScreen', { screen: 'diploma' });
  send('next', {});
  assert.equal(store.runtime.screen, 'recap');

  send('prev', {});
  assert.equal(store.runtime.screen, 'diploma');
});

test('блокнот ведущего сохраняется и не уходит гостям', async () => {
  reset();
  const { playShow } = await import('../server/project.js');

  send('setNotebook', { text: 'Порядок номеров\nРеквизит: пелёнки' });
  assert.equal(store.show.notebook, 'Порядок номеров\nРеквизит: пелёнки');
  assert.equal(playShow(store.show).notebook, undefined, 'телефон гостя блокнот не получает');

  // Слишком длинный текст обрезается, а не роняет сервер.
  send('setNotebook', { text: 'я'.repeat(30000) });
  assert.equal(store.show.notebook.length, 20000);

  send('setNotebook', { text: '' });
  assert.equal(store.show.notebook, '');
});
