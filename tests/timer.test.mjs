// Таймер конкурса.
//
// Сервер не тикает — он хранит только момент, когда время выйдет. Значит,
// проверять надо не «сколько прошло», а что состояние меняется правильно и
// что сообщение «время вышло» нельзя применить дважды.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-timer-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');

const send = (type, payload) => applyCommand(type, payload || {});
const timer = () => store.runtime.timer;

function reset() {
  store.load();
  store.resetToSeed();
}

test('после перезапуска таймера нет — старое время не досчитывается', () => {
  reset();
  send('timerStart', { seconds: 60 });
  store.flush();
  store.load();
  assert.equal(store.runtime.timer, null);
});

test('запуск ставит момент окончания, а не счётчик', () => {
  reset();
  const before = Date.now();
  send('timerStart', { seconds: 45 });

  assert.equal(timer().seconds, 45);
  assert.equal(timer().running, true);
  assert.ok(timer().endsAt >= before + 45000, 'время выхода в будущем');
  assert.ok(timer().endsAt <= Date.now() + 45000);
});

test('пауза запоминает остаток, продолжение отсчитывает от него', () => {
  reset();
  send('timerStart', { seconds: 60 });
  send('timerPause');

  assert.equal(timer().running, false);
  assert.ok(timer().leftPaused > 59000 && timer().leftPaused <= 60000);

  const paused = timer().leftPaused;
  send('timerResume');
  assert.equal(timer().running, true);
  assert.equal(timer().leftPaused, 0);
  assert.ok(timer().endsAt >= Date.now() + paused - 50);
});

test('«+10 с» добавляет и на ходу, и на паузе', () => {
  reset();
  send('timerStart', { seconds: 30 });
  const was = timer().endsAt;
  send('timerAdd', { seconds: 10 });
  assert.ok(timer().endsAt - was >= 9900);
  assert.equal(timer().seconds, 40, 'кольцо на экране считает долю от общего времени');

  send('timerPause');
  const left = timer().leftPaused;
  send('timerAdd', { seconds: 10 });
  assert.ok(timer().leftPaused - left >= 9900);
});

test('«время вышло» применяется один раз', () => {
  reset();
  send('timerStart', { seconds: 5 });
  const seq = timer().seq;

  send('timerDone', { seq });
  assert.equal(timer().running, false);
  assert.equal(timer().done, true);

  // Второй экран прислал то же самое — ничего не должно произойти.
  assert.deepEqual(send('timerDone', { seq }), { ok: true });
  assert.equal(timer().done, true);
});

test('чужой номер запуска игнорируется', () => {
  reset();
  send('timerStart', { seconds: 5 });
  send('timerDone', { seq: timer().seq + 7 });
  assert.equal(timer().running, true, 'таймер продолжает идти');
});

test('по окончании таймер может сам раскрыть ответ', () => {
  reset();
  const quiz = store.show.contests.find((c) => c.id === 'c-quiz');
  send('goto', { contestId: quiz.id, itemId: quiz.items[0].id, phase: 'question' });
  send('timerStart', { seconds: 5, onEnd: 'reveal' });

  send('timerDone', { seq: timer().seq });
  assert.equal(store.runtime.phase, 'reveal');
});

test('по окончании таймер может перейти к следующему вопросу', () => {
  reset();
  const quiz = store.show.contests.find((c) => c.id === 'c-quiz');
  send('goto', { contestId: quiz.id, itemId: quiz.items[0].id, phase: 'question' });
  send('timerStart', { seconds: 5, onEnd: 'next' });

  send('timerDone', { seq: timer().seq });
  assert.equal(store.runtime.phase, 'reveal', 'сначала «Дальше» показывает ответ');
});

test('сброс убирает таймер целиком', () => {
  reset();
  send('timerStart', { seconds: 60 });
  send('timerReset');
  assert.equal(timer(), null);
  assert.deepEqual(send('timerReset'), { ok: true }, 'повторный сброс безвреден');
});

test('бессмысленное время приводится к разумному', () => {
  reset();
  send('timerStart', { seconds: 99999 });
  assert.equal(timer().seconds, 3600, 'дольше часа таймер не заводим');

  send('timerStart', { seconds: -5 });
  assert.equal(timer().seconds, 1);

  // Ноль секунд — это не таймер, а опечатка: ведём себя как без числа.
  send('timerStart', { seconds: 0 });
  assert.equal(timer().seconds, 60);
  send('timerStart', {});
  assert.equal(timer().seconds, 60, 'без числа — минута');
});

test.after(() => {
  store.flush();
  fs.rmSync(TMP, { recursive: true, force: true });
});
