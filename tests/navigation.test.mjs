// Навигация по показу. Раньше позиция хранилась номерами в отфильтрованном
// списке конкурсов: стоило выключить конкурс посреди праздника, и ведущего
// молча переносило в другое место программы. Теперь позиция — это id.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Команды пишут состояние на диск — уводим его во временную папку,
// чтобы тест не трогал настоящие данные праздника.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-test-'));
process.env.CIRK_DATA = TMP;

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

function reset() {
  store.load();
  store.resetToSeed();
}

const send = (type, payload) => applyCommand(type, payload || {});
const pos = () => {
  const r = store.runtime;
  return { screen: r.screen, contest: r.contestId, item: r.itemId, phase: r.phase };
};
const active = () => store.show.contests.filter((c) => c.enabled !== false);

test('«Дальше» ведёт от заставки через конкурсы к таблице лидеров', () => {
  reset();
  assert.equal(pos().screen, 'welcome');

  send('next');
  assert.equal(pos().screen, 'guests');

  send('next');
  const first = active()[0];
  assert.deepEqual(pos(), { screen: 'show', contest: first.id, item: first.items[0].id, phase: 'intro' });

  send('next');
  assert.equal(pos().phase, 'question');
  send('next');
  assert.equal(pos().phase, 'reveal');
  send('next');
  assert.deepEqual(
    { item: pos().item, phase: pos().phase },
    { item: first.items[1].id, phase: 'question' }
  );
});

test('«Назад» возвращает ровно туда, откуда пришли', () => {
  reset();
  const first = active()[0];
  send('goto', { contestId: first.id, itemId: first.items[2].id, phase: 'question' });

  send('prev');
  assert.deepEqual(
    { item: pos().item, phase: pos().phase },
    { item: first.items[1].id, phase: 'reveal' }
  );
  send('prev');
  assert.equal(pos().phase, 'question');
});

test('выключенный посреди показа конкурс не телепортирует ведущего', () => {
  reset();
  const list = active();
  const third = list[2];
  const fourth = list[3];

  send('goto', { contestId: third.id, itemId: third.items[0].id, phase: 'question' });
  assert.equal(pos().contest, third.id);

  // Выключаем тот конкурс, который прямо сейчас на экране.
  send('toggleContest', { id: third.id });

  assert.equal(pos().contest, fourth.id, 'должны оказаться на следующем активном конкурсе');
  assert.equal(pos().screen, 'show');
});

test('выключение другого конкурса не сдвигает текущую позицию', () => {
  reset();
  const list = active();
  const fifth = list[4];

  send('goto', { contestId: fifth.id, itemId: fifth.items[1].id, phase: 'reveal' });
  const before = pos();

  // Гасим конкурс, который стоит раньше в программе.
  send('toggleContest', { id: list[1].id });

  assert.deepEqual(pos(), before, 'позиция не должна была измениться');
});

test('удаление конкурса перед текущим не сдвигает позицию', () => {
  reset();
  const list = active();
  const fourth = list[3];
  send('goto', { contestId: fourth.id, itemId: fourth.items[0].id, phase: 'question' });

  send('deleteContest', { id: list[0].id });

  assert.equal(pos().contest, fourth.id);
  assert.equal(pos().item, fourth.items[0].id);
});

test('удаление текущего конкурса переводит на следующий', () => {
  reset();
  const list = active();
  send('goto', { contestId: list[2].id, phase: 'question' });

  send('deleteContest', { id: list[2].id });

  assert.equal(pos().contest, list[3].id);
});

test('переход по id и по номеру дают одно и то же', () => {
  reset();
  const list = active();
  send('goto', { contestId: list[3].id, itemId: list[3].items[0].id, phase: 'question' });
  const byId = pos();

  send('goScreen', { screen: 'welcome' });
  // Старая вкладка пульта могла бы прислать номера — их тоже понимаем.
  send('goto', { contestIndex: 3, itemIndex: 0, phase: 'question' });

  assert.deepEqual(pos(), byId);
});

test('репетиция возвращает и баллы, и место в программе', () => {
  reset();
  const list = active();
  send('goto', { contestId: list[1].id, itemId: list[1].items[1].id, phase: 'reveal' });
  const before = pos();
  const team = store.guests.teams[0];
  const scoreBefore = team.score || 0;

  send('rehearsal', { on: true });
  send('goto', { contestId: list[5].id, phase: 'intro' });
  send('award', { id: team.id, delta: 5 });
  assert.notEqual(store.guests.teams[0].score, scoreBefore);

  send('rehearsal', { on: false });
  assert.deepEqual(pos(), before);
  assert.equal(store.guests.teams[0].score, scoreBefore);
});

test('пустой конкурс просто пропускается', () => {
  reset();
  const list = active();
  const empty = { id: 'c-empty', type: 'quiz', enabled: true, subtitle: '', title: 'Пустой', rules: '', lionLine: '', pointsPerCorrect: 1, items: [] };
  send('saveContest', { contest: empty });

  // Встаём на афишу пустого конкурса и жмём «Дальше».
  send('goto', { contestId: 'c-empty', phase: 'intro' });
  assert.equal(pos().contest, 'c-empty');
  send('next');

  // Пустой был последним — уходим в таблицу лидеров.
  assert.equal(pos().screen, 'leaderboard');
  assert.ok(list.length >= 0);
});

test.after(() => {
  store.flush();
  fs.rmSync(TMP, { recursive: true, force: true });
});
