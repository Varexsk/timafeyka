// Что видит телефон гостя.
//
// Раньше сервер рассылал всем один снимок целиком — вместе со всеми
// правильными ответами. Никакой шаблон бы не помог: данные видно в devtools.
// Поэтому проверяем не «что нарисовалось», а что вообще ушло по проводу.

import test from 'node:test';
import assert from 'node:assert/strict';

const { project, playShow, playRuntime } = (await import('../server/project.js')).default;

// Всё, чего гость знать не должен, помечено узнаваемой строкой: если она
// найдётся где-нибудь в кадре — значит, утекла.
const SECRET = 'СЕКРЕТ';

const show = {
  title: 'Цирк Тимоши',
  hero: 'Тимофей',
  heroShort: 'Тимоша',
  lion: 'Лёва',
  age: 1,
  mode: 'teams',
  contests: [
    {
      id: 'c-quiz',
      type: 'quiz',
      enabled: true,
      title: 'Викторина',
      subtitle: 'Номер первый',
      rules: 'Правила',
      pointsPerCorrect: 2,
      video: '/media/' + SECRET + '.mp4',
      items: [{
        id: 'q1',
        q: 'Во сколько родился именинник?',
        options: [{ text: 'Ночью', icon: 'moon' }, { text: 'Днём', icon: 'sun' }],
        answer: 1,
        answerText: SECRET + '-текст',
        answerNote: SECRET + '-приписка',
        media: '/media/' + SECRET + '.jpg',
        audio: '/media/' + SECRET + '.mp3',
        value: 3250,
        at: 12.5,
        revealEnd: 18
      }]
    },
    {
      id: 'c-off',
      type: 'quiz',
      enabled: false,
      title: SECRET + '-выключенный',
      items: []
    }
  ]
};

test('в программе для гостя нет ни одного правильного ответа', () => {
  const wire = JSON.stringify(playShow(show));

  assert.ok(!wire.includes(SECRET), 'в кадре нашлось то, чего гость видеть не должен');
  assert.ok(!wire.includes('"answer"'), 'ушла отметка правильного варианта');
  assert.ok(!wire.includes('3250'), 'ушло загаданное число');
  assert.ok(!wire.includes('12.5'), 'ушла метка паузы на видео');
});

test('но вопрос и варианты гость видит — иначе не ответит', () => {
  const out = playShow(show);
  const item = out.contests[0].items[0];

  assert.equal(item.q, 'Во сколько родился именинник?');
  assert.deepEqual(item.options, [
    { text: 'Ночью', icon: 'moon' },
    { text: 'Днём', icon: 'sun' }
  ]);
  assert.equal(out.contests[0].pointsPerCorrect, 2, 'сколько стоит ответ — не секрет');
  assert.equal(out.title, 'Цирк Тимоши');
});

test('выключенные конкурсы на телефон не уходят вовсе', () => {
  const out = playShow(show);
  assert.equal(out.contests.length, 1);
  assert.equal(out.contests[0].id, 'c-quiz');
});

test('до раскрытия видно только сколько ответили', () => {
  const runtime = {
    screen: 'show', phase: 'question', contestId: 'c-quiz', itemId: 'q1',
    rounds: {
      'c-quiz/q1': {
        votes: { 't-home': { v: 0, at: 1 }, 't-guests': { v: 1, at: 2 } },
        awarded: false, gen: 0
      }
    }
  };

  const mine = playRuntime(runtime, 't-home');
  assert.equal(mine.round.answered, 2, 'счётчик виден');
  assert.equal(mine.round.votes, undefined, 'чужие ответы не ушли');
  assert.equal(mine.round.mine, 0, 'свой ответ игрок видит всегда');

  const wire = JSON.stringify(playRuntime(runtime, 't-home'));
  assert.ok(!wire.includes('t-guests'), 'по кадру нельзя понять, кто что выбрал');
});

test('свой ответ игрок видит и после раскрытия', () => {
  const runtime = {
    screen: 'show', phase: 'reveal', contestId: 'c-quiz', itemId: 'q1',
    rounds: { 'c-quiz/q1': { votes: { 't-home': { v: 2, at: 1 } }, awarded: true, gen: 0 } }
  };
  const out = playRuntime(runtime, 't-home', show);
  assert.equal(out.round.mine, 2, 'иначе на телефоне «вы не ответили» у того, кто ответил');
});

test('после раскрытия ответы видны всем', () => {
  const runtime = {
    screen: 'show', phase: 'reveal', contestId: 'c-quiz', itemId: 'q1',
    rounds: { 'c-quiz/q1': { votes: { 't-home': { v: 0, at: 1 } }, awarded: true, gen: 0 } }
  };
  const out = playRuntime(runtime, 't-home');
  assert.deepEqual(Object.keys(out.round.votes), ['t-home']);
});

test('вне показа ответ не раскрывается, даже если фаза осталась «ответ»', () => {
  // Так бывает всё время: ведущий раскрыл ответ и ушёл на заставку или
  // к таблице лидеров. Гость, открывший телефон в этот момент, не должен
  // получить ответ на вопрос, который ещё не начинали.
  const runtime = {
    screen: 'welcome', phase: 'reveal', contestId: 'c-quiz', itemId: 'q1',
    rounds: { 'c-quiz/q1': { votes: { 't-home': { v: 1, at: 1 } }, awarded: true, gen: 0 } }
  };
  const out = playRuntime(runtime, 't-home', show);
  assert.equal(out.correct, undefined, 'ответ ушёл вне показа');
  assert.equal(out.round.votes, undefined, 'и чужие ответы тоже');
});

test('телевизору, пульту и кабинету отдаём всё как есть', () => {
  const snap = { show, guests: [], teams: [], runtime: {}, play: { players: {} } };
  for (const role of ['tv', 'remote', 'admin']) {
    assert.equal(project('show', snap, role, ''), show, 'роль ' + role);
  }
  assert.notEqual(project('show', snap, 'play', ''), show, 'а телефону — урезанное');
});

test('имена и баллы не прячем — их и так видно на телевизоре', () => {
  const guests = [{ id: 'g1', name: 'Мама', score: 3 }];
  const snap = { show, guests, teams: [], runtime: {}, play: { players: {} } };
  assert.equal(project('guests', snap, 'play', ''), guests);
});

test('после раскрытия телефон узнаёт правильный ответ — иначе гость не поймёт, угадал ли', () => {
  const runtime = {
    screen: 'show', phase: 'reveal', contestId: 'c-quiz', itemId: 'q1',
    rounds: { 'c-quiz/q1': { votes: {}, awarded: true, gen: 0 } }
  };
  const out = playRuntime(runtime, 't-home', show);
  assert.equal(out.correct.answer, 1);

  // А до раскрытия — не узнаёт.
  const hidden = playRuntime(Object.assign({}, runtime, { phase: 'question' }), 't-home', show);
  assert.equal(hidden.correct, undefined);
});
