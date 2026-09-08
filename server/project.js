'use strict';

// Что видит каждая страница.
//
// Раньше сервер рассылал всем один и тот же снимок целиком. Для телевизора,
// пульта и кабинета это нормально — они у ведущего. Но телефон гостя получил
// бы вместе с состоянием и все правильные ответы: праздник кончился бы за
// пять минут, и никакой шаблон бы не помог — данные лежат в devtools.
//
// Поэтому урезаем на сервере, а не на клиенте.

const ROLES = ['tv', 'remote', 'admin', 'play'];

function isPlayer(role) {
  return role === 'play';
}

// Программа для телефона гостя: заголовки, варианты ответа — и ничего,
// по чему можно догадаться, какой из них правильный.
function playShow(show) {
  return {
    title: show.title,
    hero: show.hero,
    heroShort: show.heroShort,
    lion: show.lion,
    age: show.age,
    mode: show.mode,
    playMode: show.playMode,
    contests: (show.contests || [])
      .filter((c) => c.enabled !== false)
      .map((c) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        subtitle: c.subtitle,
        rules: c.rules,
        playMode: c.playMode,
        pointsPerCorrect: c.pointsPerCorrect,
        multiplier: c.multiplier,
        items: (c.items || []).map((it) => ({
          id: it.id,
          q: it.q,
          unit: it.unit,
          options: (it.options || []).map((o) => ({
            text: typeof o === 'string' ? o : o.text,
            icon: typeof o === 'string' ? '' : o.icon
          }))
        }))
      }))
  };
}

function itemAt(show, contestId, itemId) {
  const contest = (show.contests || []).find((c) => c.id === contestId);
  if (!contest) return null;
  return (contest.items || []).find((it) => it.id === itemId) || null;
}

// Пока ответ не раскрыт, наружу уходит «сколько ответили», а не «кто что выбрал».
// Свой собственный ответ игрок видит всегда — иначе непонятно, отправился ли он.
function playRound(round, ownerId, revealed) {
  if (!round) return null;
  const votes = round.votes || {};
  const out = {
    answered: Object.keys(votes).length,
    awarded: !!round.awarded,
    gen: round.gen || 0
  };
  // Свой ответ игрок видит всегда — и до раскрытия, и после: иначе на экране
  // «вы не ответили» у того, кто честно ответил.
  if (ownerId && votes[ownerId] !== undefined) out.mine = votes[ownerId].v;
  if (revealed) out.votes = votes;

  // Карман формата — общий: колесо должно остановиться одинаково у всех.
  if (round.slice) out.slice = round.slice;

  // Очередь жужжалки не секрет: наоборот, в ней весь смысл.
  const b = round.buzz;
  if (b) {
    out.buzz = {
      open: !!b.open,
      locked: !!b.locked,
      frozen: !!b.frozen,
      order: (b.order || []).map((x) => ({ ownerId: x.ownerId, at: x.at })),
      falseStart: ownerId ? (b.falseStart || {})[ownerId] || 0 : 0
    };
  }
  return out;
}

function playRuntime(runtime, ownerId, show) {
  // Ответ раскрыт только когда идёт показ. Иначе на заставке, где фаза
  // осталась с прошлого вопроса, телефон получал бы ответ заранее.
  const revealed = runtime.screen === 'show' && runtime.phase === 'reveal';
  const key = runtime.contestId + '/' + runtime.itemId;
  const out = {
    screen: runtime.screen,
    phase: runtime.phase,
    contestId: runtime.contestId,
    itemId: runtime.itemId,
    fx: runtime.fx,
    timer: runtime.timer || null,
    rehearsal: runtime.rehearsal ? true : null,
    lastAward: runtime.lastAward,
    round: playRound((runtime.rounds || {})[key], ownerId, revealed)
  };

  // Ответ раскрыли — теперь его можно показать и на телефоне, чтобы гость
  // увидел, угадал он или нет.
  if (revealed && show) {
    const item = itemAt(show, runtime.contestId, runtime.itemId);
    if (item) {
      out.correct = {
        answer: Number.isInteger(item.answer) ? item.answer : null,
        answerText: item.answerText || '',
        value: item.value === undefined ? null : item.value,
        unit: item.unit || ''
      };
    }
  }
  return out;
}

// Срез состояния под конкретную страницу. Для своих — как есть.
// snap — весь снимок: проекции иногда нужен соседний срез.
function project(key, snap, role, ownerId) {
  const value = key === 'guests' ? snap.guests : snap[key];
  if (!isPlayer(role)) return value;
  if (key === 'show') return playShow(value || {});
  if (key === 'runtime') return playRuntime(value || {}, ownerId, snap.show || {});
  return value; // имена, баллы и список телефонов — не секрет
}

module.exports = { project, playShow, playRuntime, ROLES };
