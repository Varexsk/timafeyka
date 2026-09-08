// Единая сборка контекста конкурса.
//
// Раньше эта функция была скопирована дважды — в app.js (экран телевизора) и
// в remote.js (пульт), — и копии уже начали расходиться. Теперь она одна, и
// каждая страница получает ровно один и тот же набор данных о том,
// что сейчас происходит на арене.

import { getType } from './registry.js';
import { owners, names, pointsOf } from '../util.js';

// Как играем этот номер: «host» — всё вводит ведущий с пульта, «phones» —
// гости отвечают со своих телефонов. У конкурса может быть своё значение,
// и оно сильнее общего: физический номер логично вести с пульта, даже если
// весь остальной праздник идёт на телефонах.
export function playModeOf(state, contest) {
  const own = contest && contest.playMode;
  if (own === 'host' || own === 'phones') return own;
  return ((state && state.show && state.show.playMode) === 'phones') ? 'phones' : 'host';
}

// Ключ раунда — «конкурс/вопрос». По нему сервер хранит ответы участников.
export function roundKey(contest, item) {
  return contest && item ? contest.id + '/' + item.id : '';
}

// Сколько ответили и как разошлись голоса. Пригодится и на экране, и на пульте.
function voteStats(votes, list) {
  const byValue = {};
  let answered = 0;
  for (const o of list) {
    const vote = votes[o.id];
    if (vote === undefined) continue;
    answered += 1;
    const key = String(vote.v);
    (byValue[key] = byValue[key] || []).push(o.id);
  }
  return { answered, total: list.length, byValue };
}

// Выключенные конкурсы просто пропускаются — их нет ни в показе, ни в нумерации.
export function activeContests(state) {
  return ((state && state.show && state.show.contests) || []).filter((c) => c.enabled !== false);
}

export function buildCtx(state) {
  const r = (state && state.runtime) || {};
  const list = activeContests(state);
  const contest = list.find((c) => c.id === r.contestId) || null;
  const items = (contest && contest.items) || [];
  // Номер вопроса — производная от id, а не наоборот: он нужен только для показа
  // «вопрос 3 из 8» и для точек перехода на пульте.
  const at = items.findIndex((it) => it.id === r.itemId);

  const item = at >= 0 ? items[at] : null;
  const key = roundKey(contest, item);
  const round = (r.rounds && r.rounds[key]) || null;
  const votes = (round && round.votes) || {};
  const people = owners(state);

  return {
    state,
    show: (state && state.show) || {},
    runtime: r,
    contest,
    contestIndex: contest ? list.indexOf(contest) : -1,
    item,
    items,
    index: at,
    total: items.length,
    phase: r.phase,
    type: contest ? getType(contest.type) : null,
    playMode: playModeOf(state, contest),
    owners: people,
    names: names(state),

    // Ответы участников на текущем вопросе.
    round,
    roundKey: key,
    // Свой карман формата: сектор колеса, оценки судьи и прочее.
    slice: (round && round.slice) || {},
    // Тот же карман, но на весь номер — блицу нужен именно такой.
    contestSlice: (contest && r.contestSlices && r.contestSlices[contest.id]) || {},
    // Сколько стоит верный ответ здесь и сейчас.
    points: pointsOf(contest),
    voteOf: (id) => (votes[id] === undefined ? null : votes[id].v),
    hasVote: (id) => votes[id] !== undefined,
    stats: voteStats(votes, people)
  };
}
