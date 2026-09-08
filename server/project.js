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
  if (revealed) out.votes = votes;
  else if (ownerId && votes[ownerId] !== undefined) out.mine = votes[ownerId].v;
  return out;
}

function playRuntime(runtime, ownerId) {
  const revealed = runtime.phase === 'reveal';
  const key = runtime.contestId + '/' + runtime.itemId;
  return {
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
}

// Срез состояния под конкретную страницу. Для своих — как есть.
function project(key, value, role, ownerId) {
  if (!isPlayer(role)) return value;
  if (key === 'show') return playShow(value || {});
  if (key === 'runtime') return playRuntime(value || {}, ownerId);
  return value; // имена и баллы — не секрет, их и так видно на телевизоре
}

module.exports = { project, playShow, playRuntime, ROLES };
