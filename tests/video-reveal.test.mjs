// «Что выберет Тимоша»: ответ появляется после ролика, а не раньше.
//
// Раньше «Дальше» на вопросе сразу раскрывало ответ: подсветка правильного
// варианта, баллы на табло и «угадал» на телефонах обгоняли видео, где
// Тимоша только тянулся к предмету. Теперь первое «Дальше» запускает ролик,
// а раскрывает ответ сам телевизор, когда видео кончилось.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-video-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');
const { playRuntime } = (await import('../server/project.js')).default;

const send = (type, payload) => applyCommand(type, payload || {});
const r = () => store.runtime;

// Встаём на первый вопрос видео-конкурса; у вопроса своё видео и нет меток.
function onVideoQuestion(video = 'media/choice.mp4') {
  store.load();
  store.resetToSeed();
  const contest = store.show.contests.find((c) => c.type === 'videoChoice');
  const item = contest.items[0];
  item.video = video;
  item.at = 0;
  item.revealEnd = 0;
  item.answer = 0;
  send('goto', { contestId: contest.id, itemId: item.id, phase: 'question' });
  return { contest, item };
}

test('«Дальше» на вопросе запускает ролик, а ответ ещё закрыт', () => {
  onVideoQuestion();
  send('next');
  assert.equal(r().phase, 'question');
  assert.ok(r().rolling, 'ролик идёт');
  assert.equal(playRuntime(r(), '', store.show).rolling, true, 'телефон знает, что ответы закрыты');
  assert.equal(playRuntime(r(), '', store.show).correct, undefined, 'ответ на телефон не ушёл');
});

test('ролик кончился — телевизор раскрывает ответ', () => {
  onVideoQuestion();
  send('next');
  send('videoDone', { seq: r().rolling.seq });
  assert.equal(r().phase, 'reveal');
  assert.equal(r().rolling, null);
});

test('чужой номер запуска ответ не раскрывает', () => {
  onVideoQuestion();
  send('next');
  send('videoDone', { seq: r().rolling.seq + 1 });
  assert.equal(r().phase, 'question');
});

test('второе «Дальше» раскрывает ответ, не дожидаясь конца ролика', () => {
  onVideoQuestion();
  send('next');
  send('next');
  assert.equal(r().phase, 'reveal');
  assert.equal(r().rolling, null);
});

test('кнопка «Ответ» ведёт себя так же: сначала ролик, потом ответ', () => {
  onVideoQuestion();
  send('reveal', { on: true });
  assert.equal(r().phase, 'question');
  assert.ok(r().rolling);
  send('reveal', { on: true });
  assert.equal(r().phase, 'reveal');
});

test('«Назад» во время ролика возвращает стоп-кадр', () => {
  onVideoQuestion();
  send('next');
  send('prev');
  assert.equal(r().phase, 'question');
  assert.equal(r().rolling, null);
});

test('пока идёт ролик, с телефона ответ не принимается', () => {
  const { contest, item } = onVideoQuestion();
  const owner = store.guests.list[0];
  send('next');
  const res = send('vote', { ownerId: owner.id, playerId: 'p1', value: 1 });
  assert.equal(res.ok, false);
  const round = (r().rounds || {})[contest.id + '/' + item.id];
  assert.ok(!round || !round.votes[owner.id], 'голос не записан');
});

test('без видео ответ раскрывается сразу, как раньше', () => {
  onVideoQuestion('');
  const contest = store.show.contests.find((c) => c.type === 'videoChoice');
  contest.video = '';
  send('next');
  assert.equal(r().phase, 'reveal');
});

test('другие конкурсы не ждут никакого ролика', () => {
  store.load();
  store.resetToSeed();
  const quiz = store.show.contests.find((c) => c.type === 'quiz');
  send('goto', { contestId: quiz.id, itemId: quiz.items[0].id, phase: 'question' });
  send('next');
  assert.equal(r().phase, 'reveal');
  assert.ok(!r().rolling);
});

test('переход на другой вопрос забывает про ролик', () => {
  onVideoQuestion();
  send('next');
  send('next');
  send('next');
  assert.equal(r().phase, 'question');
  assert.equal(r().rolling, null);
});
