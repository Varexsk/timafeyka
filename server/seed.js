'use strict';

// Стартовое наполнение праздника. Файлы в data/ создаются из этого сида при первом запуске.
// Дальше правь всё через кабинет (/admin) — сид больше не трогается.

// Команды — это семьи. Баллы считаются им, а гости просто приписаны к своей семье.
const teams = [
  { id: 't-home', name: 'Семья именинника', avatar: 'bear', color: '#E63946', score: 0 },
  { id: 't-grands', name: 'Бабушки и дедушки', avatar: 'panda', color: '#22C1BC', score: 0 },
  { id: 't-guests', name: 'Гости', avatar: 'fox', color: '#9B6BFF', score: 0 }
];

const guests = [
  { id: 'g-mama', name: 'Мама', avatar: 'seal', color: '#FF7BAC', score: 0, teamId: 't-home' },
  { id: 'g-papa', name: 'Папа', avatar: 'bear', color: '#4A90D9', score: 0, teamId: 't-home' },
  { id: 'g-baba', name: 'Бабушка', avatar: 'panda', color: '#22C1BC', score: 0, teamId: 't-grands' },
  { id: 'g-deda', name: 'Дедушка', avatar: 'giraffe', color: '#FF8A3D', score: 0, teamId: 't-grands' }
];

const quizItems = [
  {
    id: 'q1',
    q: 'Во сколько родился наш именинник?',
    options: [
      { text: 'Ночью, до 6 утра', icon: 'moon' },
      { text: 'Утром, с 6 до 12', icon: 'sunrise' },
      { text: 'Днём, с 12 до 18', icon: 'sun' },
      { text: 'Вечером, после 18', icon: 'evening' }
    ],
    answer: null,
    answerNote: ''
  },
  {
    id: 'q4',
    q: 'В какой день недели он родился?',
    options: [
      { text: 'Понедельник', icon: 'num-1' },
      { text: 'Вторник', icon: 'num-2' },
      { text: 'Среда', icon: 'num-3' },
      { text: 'Четверг', icon: 'num-4' },
      { text: 'Пятница', icon: 'num-5' },
      { text: 'Суббота', icon: 'num-6' },
      { text: 'Воскресенье', icon: 'num-7' }
    ],
    answer: null,
    answerNote: ''
  },
  { id: 'q5', q: 'Какое первое слово он сказал?', options: [], answer: null, answerNote: '' },
  {
    id: 'q6',
    q: 'Когда он сделал свой первый шаг?',
    options: [
      { text: 'В 9 месяцев', icon: 'footprints' },
      { text: 'В 10 месяцев', icon: 'footprints' },
      { text: 'В 11 месяцев', icon: 'footprints' },
      { text: 'Ещё не пошёл — но вот-вот!', icon: 'crawling' }
    ],
    answer: null,
    answerNote: ''
  },
  {
    id: 'q7',
    q: 'Какой зубик появился первым?',
    options: [
      { text: 'Нижний слева', icon: 'tooth' },
      { text: 'Нижний справа', icon: 'tooth' },
      { text: 'Верхний слева', icon: 'tooth' },
      { text: 'Верхний справа', icon: 'tooth' }
    ],
    answer: null,
    answerNote: ''
  },
  { id: 'q8', q: 'Какую игрушку он любит больше всего?', options: [], answer: null, answerNote: '' },
  { id: 'q9', q: 'Какое блюдо он любит больше всего?', options: [], answer: null, answerNote: '' },
  { id: 'q10', q: 'Что он любит делать больше всего?', options: [], answer: null, answerNote: '' },
  { id: 'q11', q: 'Чего он не любит?', options: [], answer: null, answerNote: '' },
  { id: 'q12', q: 'Какой мультик или песенка ему нравится?', options: [], answer: null, answerNote: '' },
  {
    id: 'q13',
    q: 'Кто его самый любимый человек после мамы и папы? 😄',
    options: [],
    answer: null,
    answerNote: ''
  },
  {
    id: 'q14',
    q: 'Какое у него сейчас самое смешное слово или звук?',
    options: [],
    answer: null,
    answerNote: ''
  },
  {
    id: 'q15',
    q: 'На кого он больше похож — на маму или на папу?',
    options: [
      { text: 'На маму', icon: 'mom' },
      { text: 'На папу', icon: 'dad' },
      { text: 'Сам на себя!', icon: 'baby' },
      { text: 'Ровно пополам', icon: 'both' }
    ],
    answer: null,
    answerNote: ''
  }
];

const videoPairs = [
  { id: 'v1', a: ['Игрушка', 'teddy'], b: ['Телефон', 'phone'] },
  { id: 'v2', a: ['Банан', 'banana'], b: ['Печенье', 'cookie'] },
  { id: 'v3', a: ['Папа', 'dad'], b: ['Мама', 'mom'], c: ['Алиса', 'speaker'] },
  { id: 'v4', a: ['Ходить', 'walking'], b: ['Ползать', 'crawling'] },
  { id: 'v5', a: ['Машинка', 'car'], b: ['Кукла', 'doll'] },
  { id: 'v6', a: ['Пюрешка', 'bowl'], b: ['Морковка', 'carrot'] }
];

const videoItems = videoPairs.map((p, i) => ({
  id: p.id,
  q: 'Что выберет Тимоша?',
  options: [p.a, p.b, p.c].filter(Boolean).map(([text, icon]) => ({ text, icon })),
  answer: null,
  answerNote: '',
  at: 0, // секунда, на которой видео встанет на паузу — проставь в кабинете
  revealEnd: 0 // до какой секунды доиграть при раскрытии (0 = 6 секунд от паузы)
}));

const contests = [
  {
    id: 'c-quiz',
    type: 'quiz',
    enabled: true,
    subtitle: 'Номер первый',
    title: 'Как хорошо вы знаете Тимошу?',
    rules: 'Ведущий читает вопрос, гости кричат ответ. За верный — балл!',
    lionLine: 'Р-р-разминка! Кто тут у нас главный знаток именинника?',
    pointsPerCorrect: 1,
    items: quizItems
  },
  {
    id: 'c-video',
    type: 'videoChoice',
    enabled: true,
    subtitle: 'Номер второй',
    title: 'Что выберет Тимоша?',
    rules: 'Видео замирает в момент выбора. Голосуем — и смотрим, что решил наш артист!',
    lionLine: 'Тише-тише! Сейчас сам маэстро сделает свой выбор…',
    pointsPerCorrect: 1,
    video: '',
    items: videoItems
  },
  {
    id: 'c-photo',
    type: 'photoGuess',
    enabled: true,
    subtitle: 'Номер третий',
    title: 'Угадай, кто на фото',
    rules: 'На арене — портрет из волшебной машины. Угадайте, кто из гостей на нём спрятался!',
    lionLine: 'Ох и чудеса… Кажется, я где-то видел этот нос!',
    pointsPerCorrect: 1,
    items: [
      { id: 'p1', q: 'Кто это?', media: '', options: [], answer: null, answerNote: '' },
      { id: 'p2', q: 'Кто это?', media: '', options: [], answer: null, answerNote: '' },
      { id: 'p3', q: 'Кто это?', media: '', options: [], answer: null, answerNote: '' }
    ]
  },
  {
    id: 'c-truefalse',
    type: 'trueFalse',
    enabled: true,
    subtitle: 'Антракт',
    title: 'Правда или ложь',
    rules: 'Львёнок рассказывает историю про Тимошу. Верите — кричите «правда», не верите — «ложь».',
    lionLine: 'Клянусь гривой, половина из этого — чистая выдумка!',
    pointsPerCorrect: 1,
    items: [
      { id: 't1', q: 'Тимоша засыпает только под звук работающего фена', answer: null, answerNote: '' },
      { id: 't2', q: 'Первое, что он сделал утром в свой день рождения, — показал язык', answer: null, answerNote: '' },
      { id: 't3', q: 'Он умеет открывать холодильник', answer: null, answerNote: '' },
      { id: 't4', q: 'Его любимое место в доме — под столом', answer: null, answerNote: '' },
      { id: 't5', q: 'Он боится пылесоса', answer: null, answerNote: '' },
      { id: 't6', q: 'Он уже пробовал есть песок', answer: null, answerNote: '' }
    ]
  },
  {
    id: 'c-audio',
    type: 'audioGuess',
    enabled: false,
    subtitle: 'Номер четвёртый',
    title: 'Угадай мелодию',
    rules: 'Звучит любимая песенка именинника. Кто первым назовёт — тот и молодец.',
    lionLine: 'А ну-ка, оркестр! Только тс-с-с, картинку не показываем.',
    pointsPerCorrect: 1,
    items: [
      { id: 'a1', q: 'Что за песенка?', audio: '', options: [], answer: null, answerNote: '' },
      { id: 'a2', q: 'Что за песенка?', audio: '', options: [], answer: null, answerNote: '' },
      { id: 'a3', q: 'Что за песенка?', audio: '', options: [], answer: null, answerNote: '' }
    ]
  },
  {
    id: 'c-challenge',
    type: 'challenge',
    enabled: true,
    subtitle: 'Финальный номер',
    title: 'Цирковые фанты',
    rules: 'Львёнок раздаёт задания. Справился — получаешь балл от ведущего.',
    lionLine: 'На арене — вы! Не бойтесь, львы сегодня добрые.',
    pointsPerCorrect: 1,
    items: [
      { id: 'f1', q: 'Изобразите слона: хобот, походка и громкий трубный звук!', answerNote: '' },
      { id: 'f2', q: 'Спойте колыбельную голосом строгого дрессировщика', answerNote: '' },
      { id: 'f3', q: 'Пройдите по канату — по прямой линии, с бокалом в руке', answerNote: '' },
      { id: 'f4', q: 'Скажите тост, в котором есть слова «лев», «арена» и «Тимоша»', answerNote: '' },
      { id: 'f5', q: 'Покажите, как Тимоша ест кашу. Без слов!', answerNote: '' },
      { id: 'f6', q: 'Придумайте и покажите цирковой номер для именинника', answerNote: '' }
    ]
  }
];

const betItems = [
  { id: 'b1', q: 'Какой был вес при рождении?', value: null, unit: 'г', answerNote: '' },
  { id: 'b2', q: 'Какой был рост при рождении?', value: null, unit: 'см', answerNote: '' },
  { id: 'b3', q: 'Сколько у Тимоши сейчас зубов?', value: null, unit: 'шт', answerNote: '' },
  { id: 'b4', q: 'Сколько слов он уже говорит?', value: null, unit: 'слов', answerNote: '' }
];

const quoteItems = [
  { id: 'z1', q: 'Впиши сюда цитату гостя про Тимошу', options: [], answer: null, answerNote: '' },
  { id: 'z2', q: 'И ещё одну — кто это сказал?', options: [], answer: null, answerNote: '' },
  { id: 'z3', q: 'И третью, посмешнее', options: [], answer: null, answerNote: '' },
  { id: 'z4', q: 'И четвёртую, потрогательнее', options: [], answer: null, answerNote: '' }
];

contests.splice(1, 0, {
  id: 'c-bets',
  type: 'bets',
  enabled: true,
  subtitle: 'Ставки, господа',
  title: 'Кто ближе к правде',
  rules: 'Каждая семья называет своё число. Ведущий записывает — и побеждает тот, кто ближе всех!',
  lionLine: 'Делайте ваши ставки! Точность решает всё.',
  pointsPerCorrect: 1,
  items: betItems
});

contests.splice(4, 0, {
  id: 'c-quotes',
  type: 'quotes',
  enabled: true,
  subtitle: 'Номер особенный',
  title: 'Кто это сказал?',
  rules: 'На экране — слова одного из гостей о Тимоше. Угадайте автора!',
  lionLine: 'Кто-то из вас проговорился… но кто?',
  pointsPerCorrect: 1,
  items: quoteItems
});

const show = {
  hero: 'Тимофей',
  heroShort: 'Тимоша',
  age: 1,
  lion: 'Лёва',
  // Название пишется целиком: «Цирк Тимоши» — родительный падеж,
  // из «Тимоша» его автоматически не получить.
  title: 'Цирк Тимоши',
  mode: 'teams', // 'teams' — считаем по семьям, 'guests' — каждому гостю отдельно
  contests
};

const runtime = {
  screen: 'welcome',
  // Позиция в показе — по id, а не по номеру: выключенный посреди праздника
  // конкурс не должен утаскивать ведущего в другое место программы.
  contestId: '',
  itemId: '',
  phase: 'intro',
  lionLine: '',
  fx: { type: '', seq: 0 },
  music: { on: false, seq: 0 },
  video: { action: 'pause', seq: 0, at: 0 },
  bets: {},
  lastAward: null,
  // Последние начисления — чтобы ведущий мог отменить промах одним касанием.
  awardLog: []
};

module.exports = { show, guests: { list: guests, teams }, runtime };
