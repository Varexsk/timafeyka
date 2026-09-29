// «Номер на арене» в режиме дуэли: двое на скорость, например собирают
// бумажный пазл из фото именинника. Проверяем, кого считать парой, кто
// победил и что показывает секундомер.

import test from 'node:test';
import assert from 'node:assert/strict';

const { _test } = await import('../public/js/types/physical.js');
const { racers, leader, stopwatch, laneClock } = _test;

const guests = [
  { id: 'g1', name: 'Бабушка Валя', teamId: 't1' },
  { id: 'g2', name: 'Дедушка Женя', teamId: 't1' },
  { id: 'g3', name: 'Тетя Лида', teamId: 't2' }
];

function ctx(slice = {}, runtime = {}, item = { judge: 'race', seconds: 0 }) {
  return { state: { guests }, slice, runtime, item };
}

test('пара берётся с колеса, запущенного из этого задания', () => {
  const runtime = { partyDraw: { seq: 5, picks: [{ id: 'g3' }, { id: 'g1' }] } };
  assert.deepEqual(racers(ctx({ drawSeq: 5 }, runtime)).map((g) => g.id), ['g3', 'g1']);
  assert.deepEqual(racers(ctx({ drawSeq: 4 }, runtime)), [], 'чужое колесо не считается');
});

test('пара, выбранная вручную, важнее колеса', () => {
  const runtime = { partyDraw: { seq: 5, picks: [{ id: 'g3' }, { id: 'g1' }] } };
  assert.deepEqual(racers(ctx({ drawSeq: 5, racers: ['g2', 'g1'] }, runtime)).map((g) => g.id), ['g2', 'g1']);
});

test('побеждает тот, кто закончил быстрее', () => {
  const c = ctx({ racers: ['g1', 'g2'], startedAt: 1, t_g1: 52000, t_g2: 41300 });
  assert.equal(leader(c).id, 'g2');
});

test('пока никто не закончил — победителя нет', () => {
  assert.equal(leader(ctx({ racers: ['g1', 'g2'], startedAt: 1 })), null);
});

test('секундомер пишется по-человечески', () => {
  assert.equal(stopwatch(41300), '41,3');
  assert.equal(stopwatch(83400), '1:23,4');
  assert.equal(stopwatch(0), '0,0');
});

test('дорожка: ждём старта, идёт время, финиш, время вышло', () => {
  const g = guests[0];
  assert.equal(laneClock(ctx({ racers: ['g1'] }), g).state, 'wait');
  assert.deepEqual(laneClock(ctx({ racers: ['g1'], startedAt: 1000 }), g, 13500), { text: '12,5', state: 'run' });
  assert.deepEqual(laneClock(ctx({ racers: ['g1'], startedAt: 1000, t_g1: 9000 }), g, 99999), { text: '9,0', state: 'done' });
  const limited = ctx({ racers: ['g1'], startedAt: 1000 }, {}, { judge: 'race', seconds: 45 });
  assert.equal(laneClock(limited, g, 47000).state, 'late');
});

// ——— две пары от семей: «Поймай попкорн» ———

const { pairTeams, duoOf, pairsLeader, timeUp } = _test;

const teams = [{ id: 't1', name: 'Бабушки' }, { id: 't2', name: 'Тёти' }];
const family = [
  { id: 'a1', name: 'Баба Валя', teamId: 't1' }, { id: 'a2', name: 'Дед Женя', teamId: 't1' },
  { id: 'b1', name: 'Тетя Лида', teamId: 't2' }, { id: 'b2', name: 'Дядя Андрей', teamId: 't2' }
];

function pairsCtx(slice = {}, timer = null) {
  return {
    state: { guests: family, teams },
    contest: { id: 'c' }, item: { id: 'i', judge: 'pairs', seconds: 30 },
    slice, runtime: { timer }
  };
}

test('пары: семьи и кто бросает, кто ловит', () => {
  const c = pairsCtx({ teams: ['t2', 't1'], m_t2: ['b2', 'b1'] });
  assert.deepEqual(pairTeams(c).map((t) => t.id), ['t2', 't1']);
  assert.deepEqual(duoOf(c, teams[1]).map((g) => g.id), ['b2', 'b1'], 'первый бросает, второй ловит');
});

test('пары: побеждает семья, поймавшая больше; ничья — без победителя', () => {
  assert.equal(pairsLeader(pairsCtx({ teams: ['t1', 't2'], c_t1: 7, c_t2: 11 })).id, 't2');
  assert.equal(pairsLeader(pairsCtx({ teams: ['t1', 't2'], c_t1: 5, c_t2: 5 })), null);
});

test('пары: итог объявляется, когда таймер этого задания отзвенел', () => {
  const ended = { contestId: 'c', itemId: 'i', running: false, leftPaused: 0, seconds: 30 };
  assert.equal(timeUp(pairsCtx({}, ended)), true);
  assert.equal(timeUp(pairsCtx({}, { ...ended, itemId: 'чужое' })), false);
  assert.equal(timeUp(pairsCtx({}, { ...ended, running: true, endsAt: Date.now() + 10000 })), false);
});
