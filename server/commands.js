'use strict';

const { store, clone } = require('./store');
const types = require('./types');
const party = require('./party');

// Звери и артисты из public/js/avatars.js — раздаются гостям по кругу.
const AVATARS = ['elephant', 'bear', 'panda', 'fox', 'tiger', 'zebra',
  'monkey', 'seal', 'giraffe', 'poodle', 'raccoon', 'parrot',
  'lion', 'rabbit', 'cat', 'puppy', 'koala', 'piglet', 'mouse', 'frog',
  'penguin', 'owl', 'hippo', 'unicorn', 'clown', 'magician'];
const COLORS = ['#E63946', '#9B6BFF', '#4A90D9', '#22C1BC', '#4CC96A', '#FF8A3D', '#FF7BAC', '#FFC93C'];

const SCREENS = ['welcome', 'guests', 'show', 'leaderboard', 'finale', 'diploma', 'recap'];

function activeContests() {
  return (store.show.contests || []).filter((c) => c.enabled !== false);
}

// Где мы сейчас — хранится id конкурса и id вопроса, а не их номера.
// По номерам было хрупко: стоило выключить конкурс посреди показа, и
// ведущего молча переносило в другое место программы.
function currentContest() {
  return activeContests().find((c) => c.id === store.runtime.contestId) || null;
}

function contestPos() {
  return activeContests().findIndex((c) => c.id === store.runtime.contestId);
}

function itemPos(contest) {
  return itemsOf(contest).findIndex((it) => it.id === store.runtime.itemId);
}

// Встаём на конкретный вопрос конкретного конкурса.
function setPos(contest, itemIndex, phase) {
  const r = store.runtime;
  r.contestId = contest ? contest.id : '';
  const it = itemsOf(contest)[itemIndex];
  r.itemId = it ? it.id : '';
  r.phase = phase;
  r.rolling = null;
}

// Ролик доигрывается перед ответом — на этом самом вопросе.
function rollingNow() {
  const r = store.runtime;
  const roll = r.rolling;
  if (!roll || r.screen !== 'show' || r.phase !== 'question') return null;
  return roll.contestId === r.contestId && roll.itemId === r.itemId ? roll : null;
}

// Вопрос → ответ. Если формат просит сперва доиграть видео (выбор Тимоши
// виден на ролике), первое нажатие запускает ролик, а ответ раскроет
// телевизор, когда видео кончится. Второе нажатие — раскрыть сразу.
function toReveal() {
  const r = store.runtime;
  const contest = currentContest();
  const item = currentItem();
  const decl = contest && types.get(contest.type);
  const hasVideo = item && (item.video || contest.video);
  if (!rollingNow() && decl && decl.revealAfterVideo && hasVideo) {
    r.rolling = { contestId: r.contestId, itemId: r.itemId, seq: Date.now() };
    return;
  }
  r.rolling = null;
  r.phase = 'reveal';
}

function itemsOf(contest) {
  return (contest && contest.items) || [];
}

function newId(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8);
}

// Очки может получать семья или отдельный гость — ищем и там, и там.
function findOwner(id) {
  if (!id) return null;
  return store.guests.teams.find((t) => t.id === id)
    || store.guests.list.find((g) => g.id === id)
    || null;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ——— навигация по показу ———

function goContest(i, atEnd) {
  const list = activeContests();
  const r = store.runtime;
  if (i < 0) { r.screen = 'guests'; return; }
  if (i >= list.length) { r.screen = 'leaderboard'; return; }
  r.screen = 'show';
  const contest = list[i];
  const items = itemsOf(contest);
  if (atEnd) {
    setPos(contest, Math.max(0, items.length - 1), items.length ? 'reveal' : 'intro');
  } else {
    setPos(contest, 0, 'intro');
  }
}

function next() {
  const r = store.runtime;
  if (r.screen === 'welcome') { r.screen = 'guests'; return; }
  if (r.screen === 'guests') { goContest(0, false); return; }
  if (r.screen === 'leaderboard') { r.screen = 'finale'; return; }
  if (r.screen === 'finale') { r.screen = 'diploma'; return; }
  if (r.screen === 'diploma') { r.screen = 'recap'; return; }
  if (r.screen === 'recap') return;

  const contest = currentContest();
  if (!contest) { r.screen = 'leaderboard'; return; }
  const items = itemsOf(contest);
  const at = itemPos(contest);

  if (r.phase === 'intro') {
    if (!items.length) { goContest(contestPos() + 1, false); return; }
    setPos(contest, 0, 'question');
    return;
  }
  if (r.phase === 'question') { if (!startOnNext()) toReveal(); return; }
  if (at + 1 < items.length) {
    setPos(contest, at + 1, 'question');
    return;
  }
  goContest(contestPos() + 1, false);
}

function prev() {
  const r = store.runtime;
  if (r.screen === 'recap') { r.screen = 'diploma'; return; }
  if (r.screen === 'diploma') { r.screen = 'finale'; return; }
  if (r.screen === 'finale') { r.screen = 'leaderboard'; return; }
  if (r.screen === 'leaderboard') { goContest(activeContests().length - 1, true); return; }
  if (r.screen === 'guests') { r.screen = 'welcome'; return; }
  if (r.screen === 'welcome') return;

  if (r.phase === 'reveal') { r.phase = 'question'; return; }
  // Ролик идёт — «Назад» просто возвращает его на стоп-кадр.
  if (rollingNow()) { r.rolling = null; return; }
  if (r.phase === 'question') {
    const contest = currentContest();
    const at = itemPos(contest);
    if (at > 0) { setPos(contest, at - 1, 'reveal'); return; }
    r.phase = 'intro';
    return;
  }
  goContest(contestPos() - 1, true);
}

// Ведущий сам перешёл по программе — значит, колесо участников, фотоальбом
// и прочие наложения своё отыграли. Раньше их закрывал только запуск номера
// из плана вечера, а после выбора конкурса с пульта колесо так и висело
// поверх сцены. Музыка DJ-пульта при этом не трогается.
function closeOverlays() {
  const r = store.runtime;
  for (const key of ['album', 'partyDraw', 'ceremony', 'capsuleStage', 'albumStage']) {
    if (r[key] && r[key].open) r[key].open = false;
  }
  if (r.album) r.album.playing = false;
}

// Конкурс могли выключить или удалить прямо посреди показа. Тогда переходим
// к ближайшему следующему активному, а не прыгаем куда попало.
function ensurePosition(fromIndexInShow) {
  const r = store.runtime;
  const list = activeContests();
  if (!list.length) { r.contestId = ''; r.itemId = ''; return; }

  const contest = currentContest();
  if (contest) {
    const items = itemsOf(contest);
    if (items.length && itemPos(contest) < 0) setPos(contest, 0, 'intro');
    return;
  }

  const all = store.show.contests || [];
  const from = typeof fromIndexInShow === 'number' ? Math.max(0, fromIndexInShow) : 0;
  let next = null;
  for (let i = from; i < all.length; i++) {
    if (all[i].enabled !== false) { next = all[i]; break; }
  }
  if (!next) next = list[list.length - 1];

  // Экран не трогаем: если ведущий не в показе, просто запоминаем новое место.
  const screen = r.screen;
  goContest(list.indexOf(next), false);
  r.screen = screen;
}

// ——— раунды ———
//
// Раунд — это один вопрос одного конкурса: кто что ответил и начислены ли
// за него баллы. Раньше такое хранилище было только у «Ставок» (runtime.bets),
// жило отдельной командой и никогда не чистилось.

function roundKey(contest, item) {
  return contest && item ? contest.id + '/' + item.id : '';
}

function currentItem() {
  const contest = currentContest();
  if (!contest) return null;
  return itemsOf(contest).find((it) => it.id === store.runtime.itemId) || null;
}

// Держим последние шесть раундов: текущий и пять предыдущих — их хватает,
// чтобы отменить начисление и вернуться на пару вопросов назад.
const KEEP_ROUNDS = 6;

function roundAt(key, create) {
  const r = store.runtime;
  if (!r.rounds) r.rounds = {};
  if (!Array.isArray(r.roundOrder)) r.roundOrder = [];
  if (!key) return null;
  if (!r.rounds[key]) {
    if (!create) return null;
    r.rounds[key] = { votes: {}, awarded: false, gen: 0 };
  }
  const at = r.roundOrder.indexOf(key);
  if (at >= 0) r.roundOrder.splice(at, 1);
  r.roundOrder.push(key);
  while (r.roundOrder.length > KEEP_ROUNDS) {
    delete r.rounds[r.roundOrder.shift()];
  }
  return r.rounds[key];
}

// ——— ответ семьи ———
//
// За семью играют несколько человек, и отвечают они с разных телефонов. Раньше
// каждый следующий ответ затирал предыдущий: в зачёт шёл тот, кто нажал позже
// всех, а разнобой внутри семьи никто не видел. Теперь сервер помнит ответ
// каждого телефона (votes[ownerId].by), а наружу отдаёт один ответ семьи — в том
// же поле .v, что и раньше. Поэтому форматы, проекции и начисление баллов
// ничего не заметили: для них семья по-прежнему отвечает одним голосом.
//
// Как сводится: числа — среднее (бабушки назвали 3200, 3300 и 3250 — семья
// сказала 3250), варианты — большинство. При ничьей побеждает то, за что
// проголосовали последним: семья передумала. Текст свести нельзя — остаётся
// последний. Формат может попросить своё правило полем participation.vote.family.

const FAMILY_BY_KIND = { number: 'average', choice: 'majority', guest: 'majority', text: 'last' };

function voteDecl(contest) {
  const decl = types.get(contest && contest.type);
  return (decl && decl.participation && decl.participation.vote) || {};
}

// Каким должен быть ответ, знает формат: число, номер варианта или текст.
// Раньше сервер угадывал это по самому значению — и «7 лет» становилось
// числом, а «7» из текстового ответа теряло смысл.
function castVote(contest, value) {
  const kind = voteDecl(contest).kind;
  if (kind === 'text') return String(value).slice(0, 300);
  // «Кто это сказал»: ответ — id гостя, а не номер варианта.
  if (kind === 'guest') return String(value).slice(0, 40);
  return Number(value);
}

// Правильный ответ для правила «exact»: номер варианта или id гостя.
// Пусто — значит, ответ не отмечен, и засчитывать нечего.
function rightAnswer(scoring, item) {
  const right = item[scoring.field || 'answer'];
  if (Number.isInteger(right)) return right;
  return typeof right === 'string' && right ? right : null;
}

function isRight(v, right) {
  return typeof right === 'number' ? Number(v) === right : String(v) === right;
}

// Кто ответил позже. Два телефона легко попадают в одну миллисекунду, поэтому
// при равном времени решает порядок прихода команды на сервер.
let voteTick = 0;

function later(a, b) {
  if ((a.at || 0) !== (b.at || 0)) return (a.at || 0) > (b.at || 0);
  return (a.n || 0) > (b.n || 0);
}

function familyVote(by, mode) {
  const entries = Object.values(by || {}).filter((e) => e && e.v !== undefined && e.v !== null);
  if (!entries.length) return null;
  const latest = entries.reduce((a, b) => (later(b, a) ? b : a));
  if (mode === 'last') return latest.v;

  const nums = entries.map((e) => Number(e.v)).filter((n) => isFinite(n));
  if (mode === 'average') {
    if (!nums.length) return latest.v;
    const sum = nums.reduce((total, n) => total + n, 0);
    return Math.round((sum / nums.length) * 100) / 100;
  }
  if (mode === 'max') return nums.length ? Math.max(...nums) : latest.v;

  const tally = new Map();
  for (const e of entries) {
    const cur = tally.get(e.v);
    if (!cur) tally.set(e.v, { count: 1, last: e });
    else { cur.count += 1; if (later(e, cur.last)) cur.last = e; }
  }
  let best = null;
  for (const [v, cur] of tally) {
    if (!best || cur.count > best.count || (cur.count === best.count && later(cur.last, best.last))) {
      best = { v, count: cur.count, last: cur.last };
    }
  }
  return best ? best.v : latest.v;
}

// Кто выиграл раунд — решает правило, которое объявил сам формат.
function pickWinners(scoring, item, round) {
  const votes = (round && round.votes) || {};
  const ids = Object.keys(votes);
  if (!ids.length) return [];

  if (scoring.rule === 'exact') {
    const right = rightAnswer(scoring, item);
    if (right === null) return [];
    return ids.filter((id) => isRight(votes[id].v, right));
  }

  // Аукцион: побеждает самая большая ставка. При равенстве — кто поставил раньше.
  if (scoring.rule === 'highestBid') {
    let best = 0;
    let at = Infinity;
    let winner = null;
    for (const id of ids) {
      const bid = Number(votes[id].v);
      if (!isFinite(bid) || bid <= 0) continue;
      if (bid > best || (bid === best && votes[id].at < at)) {
        best = bid;
        at = votes[id].at;
        winner = id;
      }
    }
    return winner ? [winner] : [];
  }

  if (scoring.rule === 'nearest') {
    const target = Number(item[scoring.field || 'value']);
    if (!isFinite(target) || item[scoring.field || 'value'] === null) return [];
    let best = Infinity;
    let out = [];
    for (const id of ids) {
      const v = Number(votes[id].v);
      if (!isFinite(v)) continue;
      const diff = Math.abs(v - target);
      if (diff < best - 1e-9) { best = diff; out = [id]; }
      else if (Math.abs(diff - best) < 1e-9) out.push(id);
    }
    return scoring.tie === 'first' ? out.slice(0, 1) : out;
  }

  return [];
}

// ——— летопись праздника ———
//
// Раунды живут недолго: сервер держит последние шесть, чтобы можно было
// отменить начисление. Для финального «Как это было» и для личного зачёта
// этого мало, поэтому итог каждого вопроса дописывается в летопись сразу,
// как раскрыли ответ. В репетиции не пишем — иначе прогон накануне попадёт
// в историю праздника.

function chronicle(contest, item, round, scoring) {
  const r = store.runtime;
  if (r.rehearsal) return;

  const stats = r.stats || (r.stats = { people: {}, questions: [] });
  const right = rightAnswer(scoring, item);
  const canBeRight = right !== null;
  const players = store.play.players || {};

  let voices = 0;
  let correct = 0;
  for (const vote of Object.values(round.votes || {})) {
    const named = vote && vote.by ? Object.entries(vote.by) : [['', vote]];
    for (const [playerId, voice] of named) {
      if (!voice || voice.v === undefined || voice.v === null) continue;
      voices += 1;
      const hit = canBeRight && isRight(voice.v, right);
      if (hit) correct += 1;

      // Личный зачёт ведём по гостю, а не по телефону: телефон можно сменить,
      // а бабушка Валя остаётся бабушкой Валей.
      const person = players[playerId];
      const guestId = person && person.guestId;
      if (!guestId) continue;
      const row = stats.people[guestId] || (stats.people[guestId] = { name: person.name, right: 0, total: 0 });
      row.name = person.name;
      row.total += 1;
      if (hit) row.right += 1;
    }
  }

  stats.questions.push({
    key: roundKey(contest, item),
    contest: contest.title,
    q: String(item.q || '').slice(0, 120),
    voices,
    correct,
    families: Object.keys(round.votes || {}).length,
    scored: canBeRight,
    at: Date.now()
  });
  if (stats.questions.length > 80) stats.questions.shift();
}

// ——— каждый отвечает сам ———
//
// «Семья одним голосом» — не единственный способ играть. Во втором семья
// получает баллы по доле угадавших среди ответивших: угадали двое из двух —
// полный балл, двое из четырёх — половина. Так семья из пятерых не выигрывает
// у семьи из двоих одним только числом телефонов.
//
// Считается это только там, где есть верный вариант. В «Ставках» каждый со
// своим числом означал бы, что большая семья накрывает весь диапазон и всегда
// оказывается ближайшей, — там ответ семьи по-прежнему сводится в один.

const SPEED_BONUS = 1;

function answerMode() {
  return store.show.answerMode === 'each' ? 'each' : 'family';
}

// Ответы поимённо, если они есть; иначе один ответ за всю семью.
function voicesOf(vote) {
  return vote && vote.by ? Object.values(vote.by) : vote ? [vote] : [];
}

function personalAwards(scoring, item, round, points) {
  const right = rightAnswer(scoring, item);
  if (right === null) return [];

  const out = [];
  for (const [ownerId, vote] of Object.entries(round.votes || {})) {
    const voices = voicesOf(vote);
    if (!voices.length) continue;
    const correct = voices.filter((e) => isRight(e.v, right)).length;
    if (!correct) continue;
    // Половинки считаем, четвертинки — нет: «полтора балла» за столом понятно,
    // «один и три четверти» уже нет.
    const delta = Math.round((points * correct / voices.length) * 2) / 2;
    if (delta > 0) out.push({ id: ownerId, delta });
  }
  return out;
}

// Кто ответил верно раньше всех. Время прихода ответа сервер знает и так —
// то же, по которому сводится ответ семьи.
function speedWinner(scoring, item, round) {
  const right = rightAnswer(scoring, item);
  if (right === null) return null;

  let best = null;
  for (const [ownerId, vote] of Object.entries(round.votes || {})) {
    for (const voice of voicesOf(vote)) {
      if (!isRight(voice.v, right)) continue;
      if (!best || later(best.voice, voice)) best = { ownerId, voice };
    }
  }
  return best ? best.ownerId : null;
}

function pointsFor(contest) {
  const base = Number(contest && contest.pointsPerCorrect);
  const mult = Number(contest && contest.multiplier);
  return Math.max(0, (base > 0 ? base : 1) * (mult > 0 ? mult : 1));
}

// Раскрыли ответ — раздаём баллы. Ровно один раз на раунд: повторное
// «показать/скрыть» ничего не удвоит.
function settleRound() {
  const r = store.runtime;
  if (r.screen !== 'show' || r.phase !== 'reveal') return [];
  const contest = currentContest();
  const item = currentItem();
  if (!contest || !item) return [];

  const round = roundAt(roundKey(contest, item), false);
  if (!round || round.awarded) return [];

  const decl = types.get(contest.type);
  const scoring = (decl && decl.scoring) || { rule: 'manual' };
  if (scoring.rule === 'manual') return [];

  chronicle(contest, item, round, scoring);

  const winners = pickWinners(scoring, item, round);
  round.awarded = true;
  const anyVotes = Object.keys(round.votes || {}).length > 0;
  if (!winners.length && !(answerMode() === 'each' && scoring.rule === 'exact' && anyVotes)) return [];

  // Аукцион устроен иначе: победитель платит свою ставку и забирает приз.
  if (scoring.rule === 'highestBid') {
    const id = winners[0];
    const bid = Number((round.votes[id] || {}).v) || 0;
    const prize = Number(item[scoring.prizeField || 'prize']) || pointsFor(contest);
    return applyAward([{ id, delta: prize - bid }], contest.title, roundKey(contest, item));
  }

  const points = pointsFor(contest);
  const awards = answerMode() === 'each' && scoring.rule === 'exact'
    ? personalAwards(scoring, item, round, points)
    : winners.map((id) => ({ id, delta: points }));

  // Бонус самому быстрому — поверх обычных баллов, и только там, где вообще
  // есть «верно». Медленных он не наказывает: они получают своё.
  if (contest.speedBonus && scoring.rule === 'exact') {
    const first = speedWinner(scoring, item, round);
    if (first) {
      const at = awards.find((a) => a.id === first);
      if (at) at.delta += SPEED_BONUS; else awards.push({ id: first, delta: SPEED_BONUS });
      r.speed = { ownerId: first, seq: (r.speed && r.speed.seq ? r.speed.seq : 0) + 1 };
    }
  }

  return applyAward(awards, contest.title, roundKey(contest, item));
}

// ——— жужжалка ———
//
// «Кто первый» решает сервер по времени прихода команды. Wi-Fi у всех разный,
// поэтому вычитаем половину пинга телефона — и не больше 150 мс, чтобы нельзя
// было «выиграть», приписав себе задержку.
//
// Нажатия в первые 150 мс считаются одновременными: внутри окна очередь
// пересортировывается, после — замерзает. Человек 150 мс не различает, а
// разброс домашней сети укладывается в них целиком.

const BUZZ_WINDOW = 150;
const FALSE_START_PAUSE = 2000;

function buzzOf(round) {
  if (!round.buzz) round.buzz = { open: false, locked: false, order: [], falseStart: {}, freezeAt: 0 };
  return round.buzz;
}

function freezeLater(key) {
  setTimeout(() => {
    const round = (store.runtime.rounds || {})[key];
    if (!round || !round.buzz) return;
    round.buzz.order.sort((a, b) => a.at - b.at);
    round.buzz.frozen = true;
    store.touch('runtime');
    store.emit();
  }, BUZZ_WINDOW + 10);
}

// ——— таймер ———
//
// Сервер не тикает. Он хранит момент, когда время выйдет, а считают все
// страницы сами — по часам сервера. Про истечение сообщает телевизор.

function startTimer(seconds, onEnd, label) {
  const r = store.runtime;
  const secs = Math.max(1, Math.min(3600, Math.round(Number(seconds) || 60)));
  r.timer = {
    seconds: secs,
    endsAt: Date.now() + secs * 1000,
    leftPaused: 0,
    running: true,
    seq: (r.timer && r.timer.seq ? r.timer.seq : 0) + 1,
    onEnd: ['stop', 'reveal', 'next'].includes(onEnd) ? onEnd : 'stop',
    label: String(label || '').slice(0, 60),
    contestId: r.contestId,
    itemId: r.itemId
  };
  return ['runtime'];
}

// «Дальше» на задании с таймером сначала запускает время: ведущий ждёт,
// что попытка начнётся именно по «Дальше», а раньше это нажатие молча
// переводило задание в «ответ», где у физического номера ничего не видно.
// Второе нажатие — как обычно. Формат объявляет это сам (autoStart: 'next')
// и может исключить часть заданий (when) — у дуэли свой секундомер.
function startOnNext() {
  const r = store.runtime;
  const contest = currentContest();
  const item = currentItem();
  const decl = contest && item && types.get(contest.type);
  const conf = decl && decl.timer;
  if (!conf || conf.autoStart !== 'next') return false;
  if (typeof conf.when === 'function' && !conf.when(item)) return false;
  const t = r.timer;
  if (t && t.contestId === contest.id && t.itemId === item.id) return false;
  const seconds = typeof conf.seconds === 'string' ? Number(item[conf.seconds]) : Number(conf.seconds);
  if (!(seconds > 0)) return false;
  startTimer(seconds, conf.onEnd, conf.label);
  return true;
}

// Формат может попросить таймер сам: «на этот вопрос — минута».
// Число берётся либо из объявления, либо из поля вопроса, если там имя поля.
function autoTimer() {
  const r = store.runtime;
  if (r.screen !== 'show' || r.phase !== 'question') return;
  const contest = currentContest();
  const item = currentItem();
  if (!contest || !item) return;

  const decl = types.get(contest.type);
  const conf = decl && decl.timer;
  if (!conf || conf.autoStart !== 'question') return;

  const t = r.timer;
  // Уже идёт на этом же вопросе — не перезапускаем.
  if (t && t.contestId === contest.id && t.itemId === item.id) return;

  const seconds = typeof conf.seconds === 'string' ? Number(item[conf.seconds]) : Number(conf.seconds);
  startTimer(seconds, conf.onEnd, conf.label);
}

// ——— баллы ———

// Единственное место, где меняется счёт. Пишем в журнал ровно те дельты,
// которые реально применились (счёт не уходит ниже нуля), — тогда отмена
// возвращает всё точь-в-точь.
function applyAward(entries, reason, roundKey) {
  const done = [];
  for (const e of entries || []) {
    const owner = findOwner(e.id);
    if (!owner) continue;
    const was = Number(owner.score) || 0;
    const now = Math.max(0, was + (Number(e.delta) || 0));
    if (now === was) continue;
    owner.score = now;
    done.push({ id: e.id, delta: now - was });
  }
  if (!done.length) return [];

  const r = store.runtime;
  const seq = (r.lastAward && r.lastAward.seq ? r.lastAward.seq : 0) + 1;
  r.lastAward = { seq, entries: done };
  const roster = store.show.mode === 'guests' ? store.guests.list : store.guests.teams;
  const awardedIndex = roster.findIndex((o) => o.id === done[0].id);
  if (awardedIndex >= 0) r.rosterPage = Math.floor(awardedIndex / 6);
  r.awardLog = (r.awardLog || []).concat([{
    seq,
    at: Date.now(),
    reason: String(reason || ''),
    // За какой вопрос начислено — по этому экран показывает, кто угадал.
    roundKey: roundKey || '',
    entries: done
  }]).slice(-20);
  return ['guests', 'runtime'];
}

function revertAward(entry) {
  for (const e of entry.entries || []) {
    const owner = findOwner(e.id);
    if (owner) owner.score = Math.max(0, (Number(owner.score) || 0) - e.delta);
  }
  entry.undone = true;
  const r = store.runtime;
  r.lastAward = {
    seq: (r.lastAward && r.lastAward.seq ? r.lastAward.seq : 0) + 1,
    entries: (entry.entries || []).map((e) => ({ id: e.id, delta: -e.delta }))
  };
  return ['guests', 'runtime'];
}

// ——— команды ———

// ——— музыка номера ———
//
// У конкурса может быть своя тема. Она включается сама, когда на экране
// появляется афиша номера, приглушается на вопросах — чтобы не мешать ведущему
// и гостям, — и замолкает, когда номер закончился. Ведущему больше не нужно
// помнить про кнопку «играть» ровно в тот момент, когда он объявляет конкурс.
//
// Если ведущий в это время сам выбрал трек на DJ-пульте, мы отходим в сторону
// и до конца номера музыку не трогаем: живой человек главнее расписания.

const THEME_LOUD = 0.3;
const THEME_QUIET = 0.12;

function themeMusic() {
  const r = store.runtime;
  if ((store.show.director || {}).themeMusic === 'off') return [];
  if (r.intermission && r.intermission.open) return [];

  const contest = r.screen === 'show' ? currentContest() : null;
  const at = contest ? contest.id : '';
  const want = (contest && contest.themeTrack) || '';
  const theme = r.theme || {};
  const volume = r.phase === 'intro' ? THEME_LOUD : THEME_QUIET;

  // Тот же номер, что и был: меняется только громкость по фазе.
  if (theme.at === at) {
    if (theme.taken || !theme.src) return [];
    if (r.dj && r.dj.src !== theme.src) {
      r.theme = { at, src: '', taken: true };
      return ['runtime'];
    }
    if (r.dj && Math.abs(Number(r.dj.volume) - volume) > 0.005) return party.dj({ volume });
    return [];
  }

  // Номер сменился: заводим новую тему, а старую — гасим.
  const playingMine = !theme.taken && theme.src && r.dj && r.dj.src === theme.src;
  r.theme = { at, src: want };
  if (want) return party.dj({ src: want, playing: true, loop: true, volume });
  return playingMine ? party.dj({ playing: false }) : ['runtime'];
}

const handlers = {
  ...require('./director'),
  ...require('./party'),
  rosterPage({ delta }) {
    const count = (store.show.mode === 'guests' ? store.guests.list : store.guests.teams).length;
    const pages = Math.max(1, Math.ceil(count / 6));
    const current = clamp(Number(store.runtime.rosterPage) || 0, 0, pages - 1);
    store.runtime.rosterPage = (current + (Number(delta) < 0 ? -1 : 1) + pages) % pages;
    return ['runtime'];
  },
  next() { closeOverlays(); next(); autoTimer(); return ['runtime'].concat(settleRound(), themeMusic()); },
  prev() { closeOverlays(); prev(); autoTimer(); return ['runtime'].concat(themeMusic()); },

  goScreen({ screen }) {
    if (!SCREENS.includes(screen)) return [];
    closeOverlays();
    store.runtime.screen = screen;
    if (screen === 'show') ensurePosition();
    return ['runtime'].concat(themeMusic());
  },

  // Пульт присылает id. Номера тоже принимаем — на случай старой вкладки.
  goto({ contestId, itemId, contestIndex, itemIndex, phase }) {
    const list = activeContests();
    if (!list.length) return [];
    const r = store.runtime;

    let contest = contestId ? list.find((c) => c.id === contestId) : null;
    if (!contest) contest = list[clamp(Number(contestIndex) || 0, 0, list.length - 1)];

    const items = itemsOf(contest);
    let at = itemId ? items.findIndex((it) => it.id === itemId) : -1;
    if (at < 0) at = clamp(Number(itemIndex) || 0, 0, Math.max(0, items.length - 1));

    closeOverlays();
    r.screen = 'show';
    const want = ['intro', 'question', 'reveal'].includes(phase) ? phase : 'question';
    setPos(contest, at, items.length ? want : 'intro');
    autoTimer();
    return ['runtime'].concat(settleRound(), themeMusic());
  },

  reveal({ on }) {
    const r = store.runtime;
    if (r.screen !== 'show' || r.phase === 'intro') return [];
    if (on === false) { r.phase = 'question'; r.rolling = null; }
    else if (r.phase === 'question') toReveal();
    return ['runtime'].concat(settleRound());
  },

  // Ролик с выбором доигрался — об этом сообщает телевизор. Номер запуска
  // сверяем, чтобы второй экран или запоздалое сообщение не раскрыли чужое.
  videoDone({ seq }) {
    const r = store.runtime;
    const roll = rollingNow();
    if (!roll || Number(seq) !== roll.seq) return [];
    r.rolling = null;
    r.phase = 'reveal';
    return ['runtime'].concat(settleRound());
  },

  // Гости отвлеклись на торт — вопрос уходит на экран ещё раз, крупно и с
  // дробью. Ответы при этом не сбрасываются: кто успел ответить, тот ответил.
  repeatQuestion() {
    const r = store.runtime;
    if (r.screen !== 'show' || r.phase === 'intro') return [];
    const item = currentItem();
    if (!item) return [];
    r.repeat = { seq: (r.repeat && r.repeat.seq ? r.repeat.seq : 0) + 1, q: String(item.q || '').slice(0, 200) };
    r.fx = { type: 'drumroll', seq: (r.fx && r.fx.seq ? r.fx.seq : 0) + 1 };
    return ['runtime'];
  },

  fx({ type }) {
    const r = store.runtime;
    r.fx = { type: String(type || ''), seq: (r.fx && r.fx.seq ? r.fx.seq : 0) + 1 };
    return ['runtime'];
  },

  music({ on }) {
    const r = store.runtime;
    if (on && r.dj?.playing) {
      r.dj.position = (r.dj.position || 0) + Math.max(0, (Date.now() - r.dj.startedAt) / 1000);
      r.dj.playing = false; r.dj.seq++;
    }
    r.music = { on: !!on, seq: (r.music && r.music.seq ? r.music.seq : 0) + 1 };
    return ['runtime'];
  },

  lionSay({ text }) {
    store.runtime.lionLine = String(text || '').slice(0, 240);
    return ['runtime'];
  },

  video(payload) {
    const r = store.runtime;
    r.video = {
      action: String(payload.action || 'pause'),
      at: Number(payload.at) || 0,
      until: Number(payload.until) || 0,
      seq: (r.video && r.video.seq ? r.video.seq : 0) + 1
    };
    return ['runtime'];
  },

  award(payload) {
    const id = payload.id || payload.teamId || payload.guestId;
    return applyAward([{ id, delta: Number(payload.delta) || 0 }], payload.reason || '');
  },

  // Отменить последнее начисление. Раньше ошибку можно было исправить
  // только вручную минусами, и то не всегда точно.
  undo() {
    const log = store.runtime.awardLog || [];
    for (let i = log.length - 1; i >= 0; i--) {
      if (!log[i].undone) return revertAward(log[i]);
    }
    return [];
  },

  undoAward({ seq }) {
    const entry = (store.runtime.awardLog || []).find((e) => e.seq === Number(seq) && !e.undone);
    return entry ? revertAward(entry) : [];
  },

  setScore(payload) {
    const owner = findOwner(payload.id || payload.teamId || payload.guestId);
    if (!owner) return [];
    owner.score = Math.max(0, Number(payload.score) || 0);
    return ['guests'];
  },

  resetScores() {
    store.guests.list.forEach((g) => { g.score = 0; });
    store.guests.teams.forEach((t) => { t.score = 0; });
    // Журнал начислений тоже обнуляем: отменять уже нечего.
    store.runtime.awardLog = [];
    store.runtime.lastAward = null;
    return ['guests', 'runtime'];
  },

  setMode({ mode }) {
    store.show.mode = mode === 'guests' ? 'guests' : 'teams';
    return ['show'];
  },

  addTeam({ name, avatar, color }) {
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) return [];
    const used = store.guests.teams.length;
    store.guests.teams.push({
      id: newId('t'),
      name: clean,
      avatar: avatar || AVATARS[(used + 3) % AVATARS.length],
      color: color || COLORS[used % COLORS.length],
      score: 0
    });
    return ['guests'];
  },

  updateTeam({ id, name, avatar, color }) {
    const t = store.guests.teams.find((x) => x.id === id);
    if (!t) return [];
    if (name !== undefined) t.name = String(name).trim().slice(0, 40) || t.name;
    if (avatar !== undefined) t.avatar = avatar;
    if (color !== undefined) t.color = color;
    return ['guests'];
  },

  removeTeam({ id }) {
    store.guests.teams = store.guests.teams.filter((t) => t.id !== id);
    store.guests.list.forEach((g) => { if (g.teamId === id) g.teamId = ''; });
    return ['guests'];
  },

  // Ответ участника на текущем вопросе. В режиме «только пульт» его вводит
  // ведущий, потом сюда же будут приходить ответы с телефонов гостей.
  vote({ ownerId, value, playerId }) {
    const contest = currentContest();
    const item = currentItem();
    if (!contest || !item || !ownerId) return [];
    // Выбор уже виден на ролике — с телефонов ответы больше не принимаем.
    if (playerId && rollingNow()) return { ok: false, error: 'Видео уже идёт — ответы закрыты' };
    const round = roundAt(roundKey(contest, item), true);
    const player = String(playerId || '').slice(0, 40);
    const empty = value === '' || value === null || value === undefined;

    // Ведущий вводит ответ за всю семью с пульта — и его слово последнее:
    // он смотрит в зал, а телефоны отвечают каждый за себя.
    if (!player) {
      if (empty) delete round.votes[ownerId];
      else round.votes[ownerId] = { v: castVote(contest, value), at: Date.now() };
      return ['runtime'];
    }

    const slot = round.votes[ownerId] && round.votes[ownerId].by
      ? round.votes[ownerId]
      : { v: null, at: 0, by: {} };
    if (empty) delete slot.by[player];
    else slot.by[player] = { v: castVote(contest, value), at: Date.now(), n: ++voteTick };

    // Последний участник забрал ответ — семья снова считается не ответившей.
    if (!Object.keys(slot.by).length) {
      delete round.votes[ownerId];
      return ['runtime'];
    }

    slot.v = familyVote(slot.by, voteDecl(contest).family || FAMILY_BY_KIND[voteDecl(contest).kind] || 'last');
    slot.at = Date.now();
    round.votes[ownerId] = slot;
    return ['runtime'];
  },

  clearVotes() {
    const round = roundAt(roundKey(currentContest(), currentItem()), false);
    if (!round) return [];
    round.votes = {};
    return ['runtime'];
  },

  // Переиграть вопрос: ответы стираются, баллы за него можно начислить заново.
  resetRound() {
    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    round.votes = {};
    round.awarded = false;
    round.buzz = { open: false, locked: false, order: [], falseStart: {}, freezeAt: 0 };
    round.gen = (round.gen || 0) + 1;
    return ['runtime'];
  },

  addGuest({ name, avatar, color, teamId }) {
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) return [];
    const used = store.guests.list.length;
    store.guests.list.push({
      id: newId('g'),
      name: clean,
      avatar: avatar || AVATARS[used % AVATARS.length],
      color: color || COLORS[used % COLORS.length],
      score: 0,
      teamId: teamId || ''
    });
    return ['guests'];
  },

  updateGuest({ id, name, avatar, color, teamId, playing }) {
    const g = store.guests.list.find((x) => x.id === id);
    if (!g) return [];
    // В семье «Бабушки» четверо, а к конкурсам выходят двое. Остальные за
    // столом и болеют — колесо и выход участника их не вызывают.
    if (playing !== undefined) g.playing = !!playing;
    if (name !== undefined) g.name = String(name).trim().slice(0, 40) || g.name;
    if (avatar !== undefined) { g.avatar = avatar; delete g.emoji; }
    if (color !== undefined) g.color = color;
    if (teamId !== undefined) g.teamId = teamId;
    return ['guests'];
  },

  removeGuest({ id }) {
    store.guests.list = store.guests.list.filter((x) => x.id !== id);
    return ['guests'];
  },

  saveContest({ contest }) {
    if (!contest || !contest.type) return [];
    const list = store.show.contests;
    const c = clone(contest);
    if (!c.id) c.id = newId('c');
    const i = list.findIndex((x) => x.id === c.id);
    if (i >= 0) list[i] = c; else list.push(c);
    // Вопрос, на котором мы стояли, мог исчезнуть при правке.
    ensurePosition();
    return ['show', 'runtime'];
  },

  deleteContest({ id }) {
    const at = (store.show.contests || []).findIndex((c) => c.id === id);
    store.show.contests = store.show.contests.filter((c) => c.id !== id);
    ensurePosition(at);
    return ['show', 'runtime'];
  },

  toggleContest({ id, enabled }) {
    const list = store.show.contests;
    const c = list.find((x) => x.id === id);
    if (!c) return [];
    c.enabled = enabled === undefined ? c.enabled === false : !!enabled;
    // Выключили тот конкурс, что сейчас на экране, — переходим к следующему.
    ensurePosition(list.findIndex((x) => x.id === id));
    return ['show', 'runtime'];
  },

  moveContest({ id, dir }) {
    const list = store.show.contests;
    const i = list.findIndex((c) => c.id === id);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return [];
    const [c] = list.splice(i, 1);
    list.splice(j, 0, c);
    return ['show'];
  },

  // Репетиция: запоминаем баллы и позицию, а на выходе возвращаем всё как было.
  rehearsal({ on }) {
    const r = store.runtime;
    if (on) {
      if (r.rehearsal) return [];
      r.rehearsal = {
        scores: store.guests.list.concat(store.guests.teams).map((o) => ({ id: o.id, score: o.score || 0 })),
        screen: r.screen,
        contestId: r.contestId,
        itemId: r.itemId,
        phase: r.phase
      };
      return ['runtime'];
    }
    const snap = r.rehearsal;
    if (!snap) return [];
    for (const s2 of snap.scores || []) {
      const owner = findOwner(s2.id);
      if (owner) owner.score = s2.score;
    }
    r.screen = snap.screen;
    r.contestId = snap.contestId || '';
    r.itemId = snap.itemId || '';
    r.phase = snap.phase;
    r.rolling = null;
    r.rehearsal = null;
    return ['runtime', 'guests'];
  },

  // ——— свет и торт ———

  // Приглушить зал: декорации гаснут, светится только арена.
  spot({ on }) {
    const r = store.runtime;
    r.spot = { on: !!on, seq: (r.spot && r.spot.seq ? r.spot.seq : 0) + 1 };
    return ['runtime'];
  },

  // Торт вынесли. Время назначать бесполезно — торты никогда не вовремя,
  // поэтому отсчёт запускает ведущий, когда свечки уже зажгли.
  cake() {
    const r = store.runtime;
    r.cake = { at: Date.now() + 10500, seq: (r.cake && r.cake.seq ? r.cake.seq : 0) + 1 };
    return ['runtime'];
  },

  // ——— свой карман формата ———

  // Случайное число, одинаковое для всех экранов. Что оно значит, решает
  // формат: сектор колеса, номер фанта, порядок выступления. Главное, что
  // тянет его сервер: иначе телевизор и телефон покажут разное.
  roll({ key, max }) {
    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    const n = Math.max(1, Math.min(1000, Math.round(Number(max) || 1)));
    if (!round.slice) round.slice = {};
    const name = String(key || 'roll').slice(0, 30);
    const prev = round.slice[name];
    round.slice[name] = {
      value: Math.floor(Math.random() * n),
      seq: (prev && prev.seq ? prev.seq : 0) + 1
    };
    return ['runtime'];
  },

  // Формат может отложить в раунд что-то своё: отметку судьи, номер
  // участника, промежуточный итог. Ядро в это не заглядывает.
  // Формат может отложить что-то своё: отметку судьи, номер участника,
  // промежуточный итог. Ядро в это не заглядывает.
  //
  // scope: «round» — при вопросе (по умолчанию), «contest» — на весь номер.
  // Блицу нужен именно второй: счёт не должен обнуляться на каждом вопросе.
  setSlice({ patch, scope }) {
    if (!patch || typeof patch !== 'object') return [];

    if (scope === 'contest') {
      const contest = currentContest();
      if (!contest) return [];
      const all = store.runtime.contestSlices = store.runtime.contestSlices || {};
      all[contest.id] = Object.assign(all[contest.id] || {}, patch);
      return ['runtime'];
    }

    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    round.slice = Object.assign(round.slice || {}, patch);
    return ['runtime'];
  },

  // Прибавить к счётчику в кармане вопроса. Нужна отдельно от setSlice:
  // ведущий жмёт «+1» быстро и подряд, и каждое нажатие со своим «старым»
  // числом затирало бы соседнее. Здесь прибавляет сервер — ничего не теряется.
  sliceAdd({ key, delta }) {
    const name = String(key || '').slice(0, 60);
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return [];
    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    round.slice = round.slice || {};
    round.slice[name] = Math.max(0, (Number(round.slice[name]) || 0) + (Number(delta) || 0));
    return ['runtime'];
  },

  // ——— жужжалка ———

  // Дать сигнал: с этой секунды нажатия считаются.
  armBuzz({ on }) {
    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    const b = buzzOf(round);
    b.open = on !== false;
    if (b.open) {
      b.locked = false;
      b.order = [];
      b.freezeAt = 0;
      b.frozen = false;
    }
    return ['runtime'];
  },

  buzz({ playerId, ownerId, rtt }) {
    const round = roundAt(roundKey(currentContest(), currentItem()), true);
    if (!round) return [];
    const b = buzzOf(round);

    const player = store.play.players[playerId];
    const owner = findOwner(ownerId || (player && player.ownerId));
    if (!owner) return [];

    const now = Date.now();

    // Нажали до сигнала — фальстарт: две секунды кнопка не слушается.
    if (!b.open || b.locked) {
      b.falseStart[owner.id] = now + FALSE_START_PAUSE;
      return ['runtime'];
    }
    if (now < (b.falseStart[owner.id] || 0)) return [];
    // Из семьи в очередь попадает один — второй телефон ничего не меняет.
    if (b.order.some((x) => x.ownerId === owner.id)) return [];

    const lag = Math.min(300, Math.max(0, Number(rtt) || 0)) / 2;
    b.order.push({ ownerId: owner.id, playerId: playerId || '', at: now - lag, raw: now });

    if (!b.freezeAt) {
      b.freezeAt = now + BUZZ_WINDOW;
      freezeLater(roundKey(currentContest(), currentItem()));
    }
    return ['runtime'];
  },

  // Ведущий подтвердил ответ первого в очереди.
  buzzCorrect() {
    const contest = currentContest();
    const round = roundAt(roundKey(contest, currentItem()), false);
    if (!round || !round.buzz || !round.buzz.order.length) return [];
    const first = round.buzz.order[0];
    round.buzz.locked = true;
    round.buzz.open = false;
    return ['runtime'].concat(
      applyAward([{ id: first.ownerId, delta: pointsFor(contest) }],
        contest.title, roundKey(contest, currentItem()))
    );
  },

  // Не угадал — очередь двигается к следующему.
  buzzMiss() {
    const round = roundAt(roundKey(currentContest(), currentItem()), false);
    if (!round || !round.buzz || !round.buzz.order.length) return [];
    round.buzz.order.shift();
    return ['runtime'];
  },

  clearBuzz() {
    const round = roundAt(roundKey(currentContest(), currentItem()), false);
    if (!round || !round.buzz) return [];
    round.buzz = { open: false, locked: false, order: [], falseStart: {}, freezeAt: 0 };
    return ['runtime'];
  },

  // ——— таймер ———

  timerStart({ seconds, onEnd, label }) {
    return startTimer(seconds, onEnd, label);
  },

  timerPause() {
    const t = store.runtime.timer;
    if (!t || !t.running) return [];
    t.leftPaused = Math.max(0, t.endsAt - Date.now());
    t.running = false;
    return ['runtime'];
  },

  timerResume() {
    const t = store.runtime.timer;
    if (!t || t.running) return [];
    t.endsAt = Date.now() + (Number(t.leftPaused) || 0);
    t.leftPaused = 0;
    t.running = true;
    return ['runtime'];
  },

  timerAdd({ seconds }) {
    const t = store.runtime.timer;
    if (!t) return [];
    const add = (Number(seconds) || 0) * 1000;
    if (t.running) t.endsAt = Math.max(Date.now(), t.endsAt + add);
    else t.leftPaused = Math.max(0, (Number(t.leftPaused) || 0) + add);
    // Кольцо на экране считает долю от исходного времени — растянем и его.
    if (add > 0) t.seconds += Math.round(add / 1000);
    return ['runtime'];
  },

  timerReset() {
    if (!store.runtime.timer) return [];
    store.runtime.timer = null;
    return ['runtime'];
  },

  // Время вышло — об этом сообщает телевизор. Повтор с тем же номером
  // запуска ничего не делает, поэтому второй экран не навредит.
  timerDone({ seq }) {
    const r = store.runtime;
    const t = r.timer;
    if (!t || !t.running || Number(seq) !== t.seq) return [];
    t.running = false;
    t.leftPaused = 0;
    t.done = true;

    if (t.onEnd === 'reveal' && r.screen === 'show' && r.phase === 'question') {
      r.phase = 'reveal';
      return ['runtime'].concat(settleRound());
    }
    if (t.onEnd === 'next') {
      next();
      autoTimer();
      return ['runtime'].concat(settleRound());
    }
    return ['runtime'];
  },

  // ——— телефоны гостей ———

  // Гость выбрал себя на экране «Кто ты?». Ни сессий, ни паролей:
  // это домашняя сеть на четыре часа, а не банк.
  join({ playerId, ownerId, guestId, name }) {
    const id = String(playerId || '').slice(0, 40);
    if (!id) return [];
    const owner = findOwner(ownerId);
    if (!owner) return [];

    // За семьёй сидят живые люди, и телефон говорит, кто именно. Без этого
    // разброс ответов выглядел бы как «Бабушки: 3200 · Бабушки: 3300», а
    // личный зачёт был бы невозможен: все телефоны семьи звались одинаково.
    const person = guestId
      ? store.guests.list.find((g) => g.id === guestId && (g.teamId === owner.id || g.id === owner.id))
      : null;

    const was = store.play.players[id];
    store.play.players[id] = {
      id,
      ownerId: owner.id,
      guestId: person ? person.id : '',
      name: person ? person.name : String(name || owner.name || '').slice(0, 40),
      joinedAt: (was && was.joinedAt) || Date.now(),
      seenAt: Date.now()
    };
    return ['play'];
  },

  leave({ playerId }) {
    if (!store.play.players[playerId]) return [];
    delete store.play.players[playerId];
    return ['play'];
  },

  // Ведущий может отвязать чужой телефон из кабинета.
  kickPlayer({ playerId }) {
    if (!store.play.players[playerId]) return [];
    delete store.play.players[playerId];
    return ['play'];
  },

  // Блокнот ведущего: сценарий вечера, список реквизита, что не забыть.
  // Живёт в программе, поэтому попадает в бэкап и переживает перезапуск.
  // На телевизор и на телефоны гостей не выводится никогда.
  setNotebook({ text }) {
    store.show.notebook = String(text === undefined || text === null ? '' : text).slice(0, 20000);
    return ['show'];
  },

  // ——— фотобудка ———
  //
  // Снимки гостей живут в программе, а не в runtime: они переживают перезапуск,
  // попадают в бэкап и в семейный альбом. Дальше их можно показать на экране
  // тем же механизмом, что и подготовленный фотоальбом.
  boothPhoto({ src, ownerId, guestId }) {
    if (typeof src !== 'string' || !/^media\/booth\//.test(src) || src.includes('..')) return [];
    const list = store.show.booth || (store.show.booth = []);
    const owner = findOwner(ownerId);
    const person = guestId ? store.guests.list.find((g) => g.id === guestId) : null;
    list.push({
      id: newId('ph'),
      src,
      at: Date.now(),
      by: person ? person.name : owner ? owner.name : '',
      ownerId: owner ? owner.id : ''
    });
    // Триста кадров — это уже не праздник, а свалка: старое вытесняем.
    if (list.length > 300) list.shift();
    return ['show'];
  },

  removeBoothPhoto({ id }) {
    store.show.booth = (store.show.booth || []).filter((p) => p.id !== id);
    return ['show'];
  },

  // ——— джокеры ———
  //
  // По одному на семью за весь вечер. «50 на 50» убирает два неверных варианта
  // и только у той семьи, которая его потратила: какие именно — решает сервер,
  // поэтому подсмотреть правильный ответ в отладчике по-прежнему нельзя.
  // «Помощь зала» показывает на телевизоре, как разошлись голоса, — не раскрывая,
  // где правда.
  joker({ ownerId, kind }) {
    const r = store.runtime;
    if (r.screen !== 'show' || r.phase !== 'question' || rollingNow()) {
      return { ok: false, error: 'Джокер работает только пока идёт вопрос' };
    }
    const contest = currentContest();
    const item = currentItem();
    if (!contest || !item) return [];
    if (voteDecl(contest).kind !== 'choice') {
      return { ok: false, error: 'В этом номере джокер не поможет' };
    }
    const owner = findOwner(ownerId);
    if (!owner) return [];

    if (!r.jokers) r.jokers = {};
    const used = r.jokers[owner.id] || (r.jokers[owner.id] = {});
    if (used[kind]) return { ok: false, error: 'Этот джокер уже потрачен' };

    const round = roundAt(roundKey(contest, item), true);
    if (kind === 'fifty') {
      const right = item.answer;
      const options = item.options || [];
      if (!Number.isInteger(right) || options.length < 4) {
        return { ok: false, error: 'Здесь нечего убирать' };
      }
      const wrong = options.map((_, i) => i).filter((i) => i !== right);
      for (let i = wrong.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
      }
      if (!round.fifty) round.fifty = {};
      round.fifty[owner.id] = wrong.slice(0, 2).sort((a, b) => a - b);
    } else if (kind === 'audience') {
      round.audience = true;
    } else {
      return [];
    }

    used[kind] = roundKey(contest, item);
    return ['runtime'];
  },

  // Как считаем ответы семьи: одним голосом или каждый сам за себя.
  setAnswerMode({ mode }) {
    store.show.answerMode = mode === 'each' ? 'each' : 'family';
    return ['show'];
  },

  // Как играем: всё с пульта ведущего или гости отвечают со своих телефонов.
  setPlayMode({ mode }) {
    store.show.playMode = mode === 'phones' ? 'phones' : 'host';
    return ['show'];
  },

  updateShow({ patch }) {
    Object.assign(store.show, patch || {});
    return ['show'];
  },

  importShow({ show, guests, teams }) {
    if (show && Array.isArray(show.contests)) store.show = clone(show);
    if (Array.isArray(guests)) store.guests.list = clone(guests);
    if (Array.isArray(teams)) store.guests.teams = clone(teams);
    return ['show', 'guests'];
  }
};

function applyCommand(type, payload) {
  if (store.runtime.intermission?.open && /^(next|prev|reveal|goto|goScreen|goContest|goItem|timer.*|vote|buzz.*|armBuzz|partyDraw|album|cake.*|planLaunch|directorCue|capsuleStage|setSlice|sliceAdd|roll)$/.test(type)) return { ok: false, error: 'Сначала завершите антракт' };
  const fn = handlers[type];
  if (!fn) return { ok: false, error: 'Неизвестная команда: ' + type };
  const changed = fn(payload || {}) || [];
  if (!Array.isArray(changed)) return changed;
  if (changed.length) store.touch(...changed);
  else store.version += 1;
  return { ok: true };
}

module.exports = { applyCommand, activeContests, AVATARS, COLORS };
