import { owners } from './util.js';

export const PAGE_SIZE = 6;

export function rosterPage(state, list = owners(state)) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(pages - 1, Math.max(0, Math.floor(Number(state.runtime.rosterPage) || 0)));
  return { page, pages, list: list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) };
}

export function pagerHtml(state, list) {
  const { page, pages } = rosterPage(state, list);
  return pages > 1 ? `<div class="roster-pager">
    <button class="btn btn--ghost" data-roster="-1" aria-label="Предыдущая страница участников">↑</button>
    <span>Страница ${page + 1} из ${pages}</span>
    <button class="btn btn--ghost" data-roster="1" aria-label="Следующая страница участников">↓</button>
  </div>` : '';
}
