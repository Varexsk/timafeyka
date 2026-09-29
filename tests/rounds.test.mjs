// Раунды: ответы участников и автоматическое начисление по правилам формата.
//
// Раньше такое хранилище было только у «Ставок» — со своими командами в общем
// ядре, без сборки мусора и без автоматического начисления: балл ближайшему
// ведущий ставил отдельной кнопкой.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-round-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

const send = (type, payload) => applyCommand(type, payload || {});
const scoreOf = (id) => (store.guests.teams.find((o) => o.id === id) || {}).score;
const roundNow = () => {
  const r = store.runtime;
  return (r.rounds || {})[r.contestId + '/' + r.itemId] || null;
};

function reset() {
  store.load();
  store.resetToSeed();
  return store.guests.teams;
}

// Встаём на первый вопрос «Ставок» и вписываем правильное число.
function onBets(value) {
  const contest = store.show.contests.find((c) => c.id === 'c-bets');
  const copy = JSON.parse(JSON.stringify(contest));
  copy.items[0].value = value;
  send('saveContest', { contest: copy });
  send('goto', { contestId: 'c-bets', itemId: copy.items[0].id, phase: 'question' });
  return copy;
}

test('ответ участника попадает в раунд', () => {
  const [a] = reset();
  onBets(3250);

  send('vote', { ownerId: a.id, value: '3100' });
  assert.deepEqual(Object.keys(roundNow().votes), [a.id]);
  assert.equal(roundNow().votes[a.id].v, 3100);

  // Пустое значение стирает ответ.
  send('vote', { ownerId: a.id, value: '' });
  assert.deepEqual(Object.keys(roundNow().votes), []);
});

test('при раскрытии балл получает ближайший', () => {
  const [a, b, c] = reset();
  onBets(3250);

  send('vote', { ownerId: a.id, value: '3000' });
  send('vote', { ownerId: b.id, value: '3300' });
  send('vote', { ownerId: c.id, value: '4000' });

  send('reveal', { on: true });

  assert.equal(scoreOf(b.id), 1, 'ближе всех был 3300');
  assert.equal(scoreOf(a.id), 0);
  assert.equal(scoreOf(c.id), 0);
});

test('повторное раскрытие не удваивает баллы', () => {
  const [a, b] = reset();
  onBets(100);
  send('vote', { ownerId: a.id, value: '90' });
  send('vote', { ownerId: b.id, value: '150' });

  send('reveal', { on: true });
  send('reveal', { on: false });
  send('reveal', { on: true });
  send('next');

  assert.equal(scoreOf(a.id), 1);
});

test('одинаковый промах — балл обоим', () => {
  const [a, b, c] = reset();
  onBets(100);
  send('vote', { ownerId: a.id, value: '90' });
  send('vote', { ownerId: b.id, value: '110' });
  send('vote', { ownerId: c.id, value: '200' });

  send('reveal', { on: true });

  assert.equal(scoreOf(a.id), 1);
  assert.equal(scoreOf(b.id), 1);
  assert.equal(scoreOf(c.id), 0);
});

test('баллы за раунд начисляются с учётом ставки конкурса', () => {
  const [a] = reset();
  const contest = onBets(10);
  const withPoints = JSON.parse(JSON.stringify(contest));
  withPoints.pointsPerCorrect = 3;
  withPoints.multiplier = 2;
  send('saveContest', { contest: withPoints });
  send('goto', { contestId: 'c-bets', itemId: withPoints.items[0].id, phase: 'question' });

  send('vote', { ownerId: a.id, value: '10' });
  send('reveal', { on: true });

  assert.equal(scoreOf(a.id), 6, 'три балла, помноженные на ва-банк');
});

test('автоматическое начисление отменяется как любое другое', () => {
  const [a, b] = reset();
  onBets(100);
  send('vote', { ownerId: a.id, value: '99' });
  send('vote', { ownerId: b.id, value: '500' });
  send('reveal', { on: true });
  assert.equal(scoreOf(a.id), 1);

  send('undo');
  assert.equal(scoreOf(a.id), 0);
});

test('«переиграть вопрос» стирает ответы и разрешает начислить заново', () => {
  const [a, b] = reset();
  onBets(100);
  send('vote', { ownerId: a.id, value: '99' });
  send('reveal', { on: true });
  assert.equal(scoreOf(a.id), 1);

  send('resetRound');
  assert.deepEqual(roundNow().votes, {});
  assert.equal(roundNow().awarded, false);

  send('vote', { ownerId: b.id, value: '101' });
  send('reveal', { on: false });
  send('reveal', { on: true });
  assert.equal(scoreOf(b.id), 1, 'после переигровки балл ушёл другому');
});

test('«стереть ответы» не трогает уже начисленное', () => {
  const [a] = reset();
  onBets(100);
  send('vote', { ownerId: a.id, value: '100' });
  send('reveal', { on: true });

  send('clearVotes');
  assert.deepEqual(roundNow().votes, {});
  assert.equal(scoreOf(a.id), 1, 'балл остаётся — его убирают отменой');
});

test('конкурс без правила начисления баллы не раздаёт', () => {
  const [a] = reset();
  const fants = store.show.contests.find((c) => c.id === 'c-challenge');
  send('goto', { contestId: fants.id, itemId: fants.items[0].id, phase: 'question' });
  send('vote', { ownerId: a.id, value: '1' });
  send('reveal', { on: true });

  assert.equal(scoreOf(a.id), 0, 'за фанты балл ставит ведущий');
});

test('старые раунды не копятся бесконечно', () => {
  const [a] = reset();
  const contest = store.show.contests.find((c) => c.id === 'c-quiz');
  // Проходим по десяти вопросам, на каждом что-то отвечая.
  for (let i = 0; i < 10; i++) {
    send('goto', { contestId: contest.id, itemId: contest.items[i].id, phase: 'question' });
    send('vote', { ownerId: a.id, value: String(i) });
  }
  assert.equal(store.runtime.roundOrder.length, 6, 'держим текущий и пять предыдущих');
  assert.equal(Object.keys(store.runtime.rounds).length, 6);
});

test('аукцион: победитель платит ставку и забирает приз', () => {
  const [a, b] = reset();
  const lot = {
    id: 'c-auc', type: 'auction', enabled: true, subtitle: '', title: 'Аукцион',
    rules: '', lionLine: '', pointsPerCorrect: 1,
    items: [{ id: 'lot1', q: 'Право задуть свечку', prize: 10 }]
  };
  send('saveContest', { contest: lot });
  send('goto', { contestId: 'c-auc', itemId: 'lot1', phase: 'question' });

  // Сначала дадим семьям, чем платить.
  send('award', { id: a.id, delta: 8 });
  send('award', { id: b.id, delta: 8 });

  send('vote', { ownerId: a.id, value: '3' });
  send('vote', { ownerId: b.id, value: '7' });
  send('reveal', { on: true });

  assert.equal(scoreOf(b.id), 8 + 10 - 7, 'заплатил семь, получил десять');
  assert.equal(scoreOf(a.id), 8, 'проигравший не платит ничего');
});

function onLot(prize) {
  const lot = {
    id: 'c-auc3', type: 'auction', enabled: true, subtitle: '', title: 'Аукцион',
    rules: '', lionLine: '', pointsPerCorrect: 1,
    items: [{ id: 'lot1', q: 'Право задуть свечку', prize }]
  };
  send('saveContest', { contest: lot });
  send('goto', { contestId: 'c-auc3', itemId: 'lot1', phase: 'question' });
}

test('аукцион: ставка семьи — последняя с любого телефона, а не среднее', () => {
  const [a] = reset();
  onLot(10);
  send('award', { id: a.id, delta: 9 });

  send('vote', { ownerId: a.id, playerId: 'nina', value: '3' });
  send('vote', { ownerId: a.id, playerId: 'valya', value: '7' });
  assert.equal(roundNow().votes[a.id].v, 7, 'валя подняла табличку — в зачёт 7, а не 5');

  send('vote', { ownerId: a.id, playerId: 'nina', value: '4' });
  assert.equal(roundNow().votes[a.id].v, 4, 'нина передумала последней');
});

test('аукцион: больше, чем баллов у семьи, поставить нельзя', () => {
  const [a, b] = reset();
  onLot(10);
  send('award', { id: a.id, delta: 5 });

  const over = send('vote', { ownerId: a.id, playerId: 'nina', value: '6' });
  assert.equal(over.ok, false);
  assert.match(over.error, /5 баллов/);
  assert.equal(((roundNow() || {}).votes || {})[a.id], undefined, 'ставка не принята');

  assert.equal(send('vote', { ownerId: a.id, playerId: 'nina', value: '5' }).ok, true);
  assert.equal(send('vote', { ownerId: b.id, playerId: 'kolya', value: '1' }).ok, false, 'у семьи без баллов ставки нет');

  // Ведущий набирает цифры по одной — его упираем в потолок, а не спорим.
  send('vote', { ownerId: a.id, value: '12' });
  assert.equal(roundNow().votes[a.id].v, 5);
});

test('аукцион: при равных ставках выигрывает поставивший раньше', () => {
  const [a, b] = reset();
  onLot(10);
  send('award', { id: a.id, delta: 6 });
  send('award', { id: b.id, delta: 6 });

  send('vote', { ownerId: b.id, playerId: 'kolya', value: '4' });
  roundNow().votes[b.id].at -= 1000;
  send('vote', { ownerId: a.id, playerId: 'nina', value: '4' });
  send('reveal', { on: true });

  assert.equal(scoreOf(b.id), 6 - 4 + 10);
  assert.equal(scoreOf(a.id), 6);
});

test('аукцион без ставок никому ничего не даёт', () => {
  reset();
  const lot = {
    id: 'c-auc2', type: 'auction', enabled: true, subtitle: '', title: 'Аукцион',
    rules: '', lionLine: '', pointsPerCorrect: 1,
    items: [{ id: 'lot1', q: 'Лот', prize: 5 }]
  };
  send('saveContest', { contest: lot });
  send('goto', { contestId: 'c-auc2', itemId: 'lot1', phase: 'question' });
  send('reveal', { on: true });

  assert.deepEqual(store.runtime.awardLog, []);
});

test.after(() => {
  store.flush();
  fs.rmSync(TMP, { recursive: true, force: true });
});
