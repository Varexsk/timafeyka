'use strict';

// Семейный альбом — то, что остаётся от праздника.
//
// Раньше альбом собирался на пульте и скачивался файлом: в нём были только
// письма и номинации. Теперь его собирает сервер, поэтому в альбом попадают и
// фотографии гостей из фотобудки, и итоговая таблица, и статистика вечера, —
// а на телевизоре можно показать QR-код, чтобы гости открыли его со своих
// телефонов, не дожидаясь, пока кто-то перешлёт файл.
//
// Фотографии в альбоме — обычные ссылки на media/. Пока сервер запущен,
// страница открывается у всех в доме; чтобы сохранить её насовсем, проще
// всего напечатать в PDF — об этом на самой странице и написано.

const { store } = require('./store');

function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function score(n) {
  const value = Math.round((Number(n) || 0) * 2) / 2;
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

function owners() {
  const list = store.show.mode === 'guests' ? store.guests.list : store.guests.teams;
  return (list || []).slice().sort((a, b) => (b.score || 0) - (a.score || 0));
}

// Кто чаще угадывал. Те же правила, что и на экране «Как это было».
function expert() {
  const people = ((store.runtime.stats || {}).people) || {};
  const list = Object.values(people).filter((p) => p.total >= 3);
  if (!list.length) return null;
  return list.sort((a, b) => (b.right / b.total) - (a.right / a.total) || b.right - a.right)[0];
}

const STYLE = `
  :root { color-scheme: light; }
  body { background: #f9f2e4; color: #412b41; font: 19px/1.65 Georgia, serif;
         max-width: 900px; margin: 0 auto; padding: 0 28px 80px; }
  header { text-align: center; padding: 70px 0 30px; }
  h1 { font-size: 46px; margin: .2em 0; }
  h2 { font-size: 30px; }
  small.kicker { letter-spacing: .18em; color: #916a35; text-transform: uppercase; font-size: 13px; }
  section { margin: 50px 0; }
  article { background: #fff; border: 1px solid #d7bd8b; border-radius: 16px;
            padding: 30px; margin: 22px 0; break-inside: avoid; }
  p { white-space: pre-wrap; overflow-wrap: anywhere; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; }
  .shot { background: #fff; border: 1px solid #d7bd8b; border-radius: 14px; overflow: hidden; break-inside: avoid; }
  .shot img { width: 100%; display: block; aspect-ratio: 3 / 4; object-fit: cover; }
  .shot span { display: block; padding: 8px 12px; font-size: 14px; color: #916a35; }
  table { width: 100%; border-collapse: collapse; background: #fff;
          border: 1px solid #d7bd8b; border-radius: 16px; overflow: hidden; }
  td, th { padding: 12px 18px; text-align: left; border-bottom: 1px solid #efe1c4; }
  th { background: #f4e7cd; }
  tr:last-child td { border-bottom: 0; }
  .note { color: #916a35; font-size: 15px; text-align: center; }
  @media print {
    body { margin: 0; max-width: none; padding: 0 12px; }
    header { break-after: page; }
    .note { display: none; }
  }
`;

function albumHtml() {
  const show = store.show;
  const hero = show.hero || 'Тимофей';
  const honors = show.honors || [];
  const booth = show.booth || [];
  const stats = store.runtime.stats || { questions: [] };
  const table = owners().filter((o) => (o.score || 0) > 0);
  const best = expert();

  return `<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Семейный альбом · ${esc(show.title || 'Цирк Тимоши')}</title>
<style>${STYLE}</style>

<header>
  <small class="kicker">${esc(show.title || 'Цирк Тимоши')} · первый день рождения</small>
  <h1>Наш праздник</h1>
  <p>Фотографии и звёздочки вечера</p>
</header>

${table.length ? `<section>
  <h2>Звёздочки вечера</h2>
  <table>
    <tr><th>Место</th><th>Кто</th><th>Звёздочек</th></tr>
    ${table.map((o, i) => `<tr><td>${i + 1}</td><td>${esc(o.name)}</td><td>${score(o.score)}</td></tr>`).join('')}
  </table>
  ${best ? `<p class="note">Главный знаток ${esc(hero)} — ${esc(best.name)}: ${best.right} верных из ${best.total}</p>` : ''}
  ${stats.questions && stats.questions.length ? `<p class="note">Задано вопросов: ${stats.questions.length}</p>` : ''}
</section>` : ''}

${booth.length ? `<section>
  <h2>Фотобудка</h2>
  <div class="grid">
    ${booth.map((p) => `<figure class="shot">
      <img src="/${esc(p.src)}" alt="Фотография гостей" loading="lazy">
      ${p.by ? `<span>${esc(p.by)}</span>` : ''}
    </figure>`).join('')}
  </div>
</section>` : ''}

${honors.length ? `<section>
  <h2>Наши звёзды арены</h2>
  ${honors.map((a) => `<article><small class="kicker">${esc(a.title)}</small><h2>${esc(a.name)}</h2></article>`).join('')}
</section>` : ''}

${booth.length || honors.length || table.length ? '' : '<section><p class="note">Праздник ещё не сыгран — альбом наполнится по ходу вечера.</p></section>'}

<p class="note">Чтобы сохранить альбом насовсем — напечатай эту страницу в PDF (Ctrl+P).</p>
</html>`;
}

module.exports = { albumHtml };
