// «Сказка с сюрпризом»: какие слова и когда выскакивают на экране.
//
// Слова считаются по таймеру номера на каждом экране отдельно, поэтому
// важно, чтобы порядок был одинаковым везде, а рассказчики не получали
// одни и те же слова.

import test from 'node:test';
import assert from 'node:assert/strict';

const { _test } = await import('../public/js/types/tale.js');
const { roundWords, shownCount, planned } = _test;

const contest = { id: 'c-tale', every: 10, words: Array.from({ length: 40 }, (_, i) => 'слово' + i) };
const item = { id: 'i-1', seconds: 60 };

function ctx(over = {}) {
  return { contest, item, index: 0, runtime: {}, slice: {}, ...over };
}

// Таймер этого выступления, запущенный elapsed секунд назад.
function running(elapsed) {
  return { timer: { contestId: contest.id, itemId: item.id, seconds: item.seconds, running: true,
    endsAt: Date.now() + (item.seconds - elapsed) * 1000 } };
}

test('порядок слов одинаков при каждом расчёте — у всех экранов', () => {
  assert.deepEqual(roundWords(ctx()), roundWords(ctx()));
});

test('у второго выступления другие слова', () => {
  const first = new Set(roundWords(ctx()));
  const second = roundWords(ctx({ index: 1 }));
  assert.ok(second.every((w) => !first.has(w)), 'слова не повторяются');
});

test('до старта слов нет, дальше — по одному каждые N секунд', () => {
  assert.equal(shownCount(ctx()), 0);
  assert.equal(shownCount(ctx({ runtime: running(5) })), 0);
  assert.equal(shownCount(ctx({ runtime: running(11) })), 1);
  assert.equal(shownCount(ctx({ runtime: running(31) })), 3);
});

test('в последние секунды новых слов не подкидываем', () => {
  assert.equal(planned(ctx()), 5);
  assert.equal(shownCount(ctx({ runtime: running(59) })), 5);
});

test('«Подкинуть слово» добавляет слово сверх таймера', () => {
  assert.equal(shownCount(ctx({ slice: { bump: 1 } })), 1);
  assert.equal(shownCount(ctx({ runtime: running(31), slice: { bump: 2 } })), 5);
});

test('таймер другого номера слова не двигает', () => {
  const runtime = running(31);
  runtime.timer.itemId = 'чужой';
  assert.equal(shownCount(ctx({ runtime })), 0);
});
