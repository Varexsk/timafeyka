// «Кто это сказал»: гости выбирают автора из списка гостей, а в кабинете
// отмечен только сам автор. Ответ — id гостя, а не номер варианта.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cirk-quotes-'));
process.env.CIRK_DATA = TMP;

const types = await import('../server/types.js');
await types.default.load();

const { store } = await import('../server/store.js');
const { applyCommand } = await import('../server/commands.js');
const { playShow, playRuntime } = (await import('../server/project.js')).default;

const send = (type, payload) => applyCommand(type, payload || {});
const score = (id) => store.guests.teams.find((t) => t.id === id).score || 0;

// Семейный режим, первая цитата, автор — первый гость из заготовки.
function onQuote() {
  store.load();
  store.resetToSeed();
  store.show.mode = 'teams';
  const contest = store.show.contests.find((c) => c.type === 'quotes');
  const item = contest.items[0];
  const [author, other] = store.guests.list;
  item.author = author.id;
  send('goto', { contestId: contest.id, itemId: item.id, phase: 'question' });
  const [t1, t2] = store.guests.teams;
  return { contest, item, author, other, t1, t2 };
}

test('угадавшая автора семья получает балл, ошибившаяся — нет', () => {
  const { author, other, t1, t2 } = onQuote();
  send('vote', { ownerId: t1.id, playerId: 'p1', value: author.id });
  send('vote', { ownerId: t2.id, playerId: 'p2', value: other.id });
  send('next');
  assert.equal(store.runtime.phase, 'reveal');
  assert.ok(score(t1.id) > 0, 'угадали — балл');
  assert.equal(score(t2.id), 0, 'не угадали — ноль');
});

test('в семье побеждает большинство, даже если это id гостей', () => {
  const { author, other, t1 } = onQuote();
  send('vote', { ownerId: t1.id, playerId: 'p1', value: author.id });
  send('vote', { ownerId: t1.id, playerId: 'p2', value: author.id });
  send('vote', { ownerId: t1.id, playerId: 'p3', value: other.id });
  send('next');
  assert.ok(score(t1.id) > 0);
});

test('автор не уходит на телефон, пока ответ не раскрыт', () => {
  const { author } = onQuote();
  assert.ok(!JSON.stringify(playShow(store.show)).includes(author.id), 'автора нет в программе');
  assert.equal(playRuntime(store.runtime, '', store.show).correct, undefined);
  send('next');
  assert.equal(playRuntime(store.runtime, '', store.show).correct.author, author.id);
});

test('без отмеченного автора баллы не начисляются', () => {
  const { item, author, t1 } = onQuote();
  item.author = '';
  send('vote', { ownerId: t1.id, playerId: 'p1', value: author.id });
  send('next');
  assert.equal(score(t1.id), 0);
});
