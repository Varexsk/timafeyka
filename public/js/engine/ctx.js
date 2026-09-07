// Единая сборка контекста конкурса.
//
// Раньше эта функция была скопирована дважды — в app.js (экран телевизора) и
// в remote.js (пульт), — и копии уже начали расходиться. Теперь она одна, и
// каждая страница получает ровно один и тот же набор данных о том,
// что сейчас происходит на арене.

import { getType } from './registry.js';
import { owners, names } from '../util.js';

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
  return {
    state,
    show: (state && state.show) || {},
    runtime: r,
    contest,
    contestIndex: contest ? list.indexOf(contest) : -1,
    item: at >= 0 ? items[at] : null,
    items,
    index: at,
    total: items.length,
    phase: r.phase,
    type: contest ? getType(contest.type) : null,
    owners: owners(state),
    names: names(state)
  };
}
