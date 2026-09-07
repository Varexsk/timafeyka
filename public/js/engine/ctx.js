// Единая сборка контекста конкурса.
//
// Раньше эта функция была скопирована дважды — в app.js (экран телевизора) и
// в remote.js (пульт), — и копии уже начали расходиться. Теперь она одна, и
// каждая страница получает ровно один и тот же набор данных о том,
// что сейчас происходит на арене.

import { getType } from '../types/index.js';
import { owners, names } from '../util.js';

// Выключенные конкурсы просто пропускаются — их нет ни в показе, ни в нумерации.
export function activeContests(state) {
  return ((state && state.show && state.show.contests) || []).filter((c) => c.enabled !== false);
}

export function buildCtx(state) {
  const r = (state && state.runtime) || {};
  const contest = activeContests(state)[r.contestIndex] || null;
  const items = (contest && contest.items) || [];
  return {
    state,
    show: (state && state.show) || {},
    runtime: r,
    contest,
    item: items[r.itemIndex] || null,
    index: r.itemIndex,
    total: items.length,
    phase: r.phase,
    type: contest ? getType(contest.type) : null,
    owners: owners(state),
    names: names(state)
  };
}
