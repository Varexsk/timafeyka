// Блок «Готовность к празднику» — то, по чему ведущий понимает, что ещё не заполнено.
//
// Раньше эти проверки были захардкожены в admin.js вместе с именами форматов.
// Теперь их объявляют сами форматы. Тест сверяет результат со снимком,
// сделанным до рефакторинга (tests/baseline/ready-v1.txt): список претензий
// должен совпасть строка в строку.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { problems } from '../public/js/engine/fields.js';
import seed from '../server/seed.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TYPES_DIR = path.join(HERE, '..', 'public', 'js', 'types');

async function loadTypes() {
  const byId = {};
  for (const file of fs.readdirSync(TYPES_DIR).filter((n) => n.endsWith('.js'))) {
    const mod = (await import(pathToFileURL(path.join(TYPES_DIR, file)).href)).default;
    if (mod && mod.id) byId[mod.id] = mod;
  }
  return byId;
}

// Тот же обход, что делает кабинет: сначала претензии к конкурсу, потом к вопросам.
function allProblems(show, types, state) {
  const out = [];
  for (const c of show.contests || []) {
    if (c.enabled === false) continue;
    const type = types[c.type];
    assert.ok(type, `формат «${c.type}» не найден`);
    for (const what of problems(type.fields, c, c, state)) {
      out.push(`${what} | ${c.title}`);
    }
    (c.items || []).forEach((item, i) => {
      for (const what of problems(type.itemFields, item, c, state)) {
        out.push(`${what} | ${c.title} · вопрос ${i + 1}`);
      }
    });
  }
  return out;
}

function baseline() {
  return fs.readFileSync(path.join(HERE, 'baseline', 'ready-v1.txt'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

test('список незаполненного совпадает со снимком до рефакторинга', async () => {
  const types = await loadTypes();
  const state = { show: seed.show, guests: seed.guests.list, teams: seed.guests.teams };
  assert.deepEqual(allProblems(seed.show, types, state), baseline());
});

test('у каждого формата есть описание полей вопроса', async () => {
  const types = await loadTypes();
  for (const [id, t] of Object.entries(types)) {
    assert.ok(Array.isArray(t.itemFields), `у формата «${id}» нет itemFields`);
    assert.ok(t.itemFields.length, `у формата «${id}» пустой itemFields`);
    for (const d of t.itemFields) {
      assert.ok(d.k, `у формата «${id}» поле без вида (k)`);
    }
  }
});

test('заполненный вопрос не даёт претензий', async () => {
  const types = await loadTypes();
  const state = { show: seed.show, guests: [], teams: [] };

  const full = {
    quiz: { q: 'В', options: [{ text: 'А' }], answer: 0, media: '' },
    bets: { q: 'В', value: 3250, unit: 'г' },
    videoChoice: { q: 'В', options: [{ text: 'А' }], answer: 0, at: 1.2, revealEnd: 3 },
    photoGuess: { q: 'В', options: [{ text: 'А' }], answer: 0, media: '/media/a.jpg' },
    quotes: { q: 'В', options: [{ text: 'А' }], answer: 0 },
    trueFalse: { q: 'В', answer: 1 },
    audioGuess: { q: 'В', options: [{ text: 'А' }], answer: 0, audio: '/media/a.mp3' },
    challenge: { q: 'З' }
  };

  for (const [id, item] of Object.entries(full)) {
    assert.deepEqual(problems(types[id].itemFields, item, {}, state), [],
      `формат «${id}» жалуется на заполненный вопрос`);
  }
});

test('пустой вопрос даёт ровно ожидаемые претензии', async () => {
  const types = await loadTypes();
  const state = { show: seed.show, guests: [], teams: [] };
  const empty = () => ({ q: '', options: [], answer: null, answerText: '' });

  const expected = {
    quiz: ['не отмечен правильный ответ'],
    bets: ['не заполнено правильное число'],
    videoChoice: ['не отмечен правильный ответ', 'не проставлена метка паузы'],
    photoGuess: ['не отмечен правильный ответ', 'нет фото'],
    quotes: ['не отмечен правильный ответ'],
    trueFalse: ['не отмечен правильный ответ'],
    audioGuess: ['не отмечен правильный ответ', 'нет аудио'],
    challenge: []
  };

  for (const [id, want] of Object.entries(expected)) {
    assert.deepEqual(problems(types[id].itemFields, empty(), {}, state), want,
      `формат «${id}»`);
  }
});
