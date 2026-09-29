// Кабинет: конкурсы, вопросы, гости, медиа. Всё сохраняется на сервер сразу.

import * as bus from './bus.js';
import { types, getType, loadTypes } from './engine/registry.js';
import { esc, names } from './util.js';
import { renderFields, applyInput, applyClick, problems, needsRerender, videoPrevId } from './engine/fields.js';
import { mountSprite, icon } from './icons.js';
import { mountArtSprite, art, hasArt, ART_NAMES, ART_LABELS } from './art.js';
import { mountAvatarSprite, avatar, hasAvatar, isPhotoAvatar, photoAvatar, AVATAR_IDS, AVATAR_LABELS } from './avatars.js';

await loadTypes();

const $ = (id) => document.getElementById(id);

let state = null;
let draft = null;        // копия редактируемого конкурса
let selectedId = null;
let media = [];
let musicFiles = [];
let saveTimer = 0;
let openItems = new Set();
let picker = null;       // {kind, onPick}

// ——— сохранение ———

function markSaved() {
  const s = $('saved');
  s.classList.add('is-on');
  clearTimeout(markSaved._t);
  markSaved._t = setTimeout(() => s.classList.remove('is-on'), 1200);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (draft) bus.send('saveContest', { contest: draft }).then(markSaved);
  }, 400);
}

function saveNow() {
  clearTimeout(saveTimer);
  if (draft) bus.send('saveContest', { contest: draft }).then(markSaved);
}

// ——— что ещё не заполнено ———

function itemProblems(contest, item, i) {
  const type = getType(contest.type);
  return problems(type.itemFields, item, contest, state)
    .map((what) => ({ contestId: contest.id, title: contest.title, index: i, what }));
}

function allProblems() {
  const out = [];
  for (const c of (state.show.contests || [])) {
    if (c.enabled === false) continue;
    // Сначала претензии к самому конкурсу, потом к каждому его вопросу.
    for (const what of problems(getType(c.type).fields, c, c, state)) {
      out.push({ contestId: c.id, title: c.title, index: -1, what });
    }
    (c.items || []).forEach((item, i) => out.push(...itemProblems(c, item, i)));
  }
  return out;
}

function countItems() {
  let total = 0;
  for (const c of (state.show.contests || [])) {
    if (c.enabled === false) continue;
    total += (c.items || []).length;
  }
  return total;
}

function contestReady(c) {
  if (c.enabled === false) return true;
  if (problems(getType(c.type).fields, c, c, state).length) return false;
  return (c.items || []).every((item, i) => itemProblems(c, item, i).length === 0);
}

// Готовым считаем вопрос, у которого не осталось ни одной претензии.
function countReadyItems() {
  let done = 0;
  for (const c of (state.show.contests || [])) {
    if (c.enabled === false) continue;
    (c.items || []).forEach((item, i) => {
      if (itemProblems(c, item, i).length === 0) done++;
    });
  }
  return done;
}

function renderReady() {
  const problems = allProblems();
  const total = countItems();
  const done = countReadyItems();
  const pct = total ? Math.round((done / total) * 100) : 100;
  $('readyBox').innerHTML = `
    <div class="ready-head">
      <div class="ready-num">${done}<small> из ${total}</small></div>
      <div class="ready-bar"><span style="width:${pct}%"></span></div>
    </div>
    ${problems.length ? `
      <div class="ready-list">
        ${problems.map((p) => `
          <div class="ready-item" data-fix="${esc(p.contestId)}" data-index="${p.index}">
            ${icon('alert')}
            <span class="what">${esc(p.what)}</span>
            <span class="where">${esc(p.title)}${p.index >= 0 ? ` · вопрос ${p.index + 1}` : ''}</span>
          </div>`).join('')}
      </div>`
    : `<div class="ready-ok">${icon('check-circle')} Всё заполнено — можно проводить праздник</div>`}
  `;
}

// ——— список конкурсов ———

function renderList() {
  const list = state.show.contests || [];
  $('contestList').innerHTML = list.map((c) => {
    const t = getType(c.type);
    const ok = contestReady(c);
    return `<div class="c-item ${c.id === selectedId ? 'is-active' : ''} ${c.enabled === false ? 'is-off' : ''}" data-pick="${esc(c.id)}">
      ${icon(t.icon)}
      <span class="nm">${esc(c.title)}<span class="cnt">${t.label} · ${(c.items || []).length} шт.</span></span>
      <span class="status ${ok ? 'is-ok' : 'is-warn'}" title="${ok ? 'готово' : 'есть незаполненное'}"></span>
      <button class="mini" data-move="${esc(c.id)}" data-dir="-1" title="Выше">${icon('chevron-up')}</button>
      <button class="mini" data-move="${esc(c.id)}" data-dir="1" title="Ниже">${icon('chevron-down')}</button>
      <button class="mini" data-toggle="${esc(c.id)}" title="Включить или выключить">${icon(c.enabled === false ? 'eye-off' : 'eye')}</button>
      <button class="mini is-del" data-del="${esc(c.id)}" title="Удалить">${icon('trash')}</button>
    </div>`;
  }).join('') || '<div class="muted" style="padding:.5rem">Пока пусто</div>';
}

function selectContest(id, openIndex) {
  saveNow();
  selectedId = id;
  const c = (state.show.contests || []).find((x) => x.id === id);
  draft = c ? JSON.parse(JSON.stringify(c)) : null;
  if (draft && !Array.isArray(draft.items)) draft.items = [];
  openItems = new Set(openIndex >= 0 ? [openIndex] : []);
  renderList();
  renderEditor();
  if (openIndex >= 0) {
    const node = document.querySelector(`.q-item[data-i="${openIndex}"]`);
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ——— редактор ———

// Метки снимаем с плеера самого вопроса; своего видео нет — берём общее.
function previewVideo(i) {
  return (i === undefined ? null : $(videoPrevId(i))) || $(videoPrevId());
}

// Всё, что нужно движку полей: где взять данные и как отозваться на кнопки.
function fieldApi(list) {
  return {
    state,
    contest: draft,
    media: list || media,
    openPicker,
    rerender: renderEditor,
    save: saveNow,
    videoTime: (i) => { const v = previewVideo(i); return v ? v.currentTime : null; },
    videoSeek: (t, i) => {
      const v = previewVideo(i);
      if (!v) return;
      v.currentTime = t;
      v.play().catch(() => {});
    }
  };
}

function itemBody(item, i, type) {
  return `
    ${renderFields(type.itemFields, item, i, fieldApi())}

    <div class="q-tools" style="justify-content:flex-end">
      <button class="a-btn a-btn--sm" data-act="moveItem" data-i="${i}" data-dir="-1">${icon('chevron-up')}</button>
      <button class="a-btn a-btn--sm" data-act="moveItem" data-i="${i}" data-dir="1">${icon('chevron-down')}</button>
      <button class="a-btn a-btn--sm a-btn--danger" data-act="delItem" data-i="${i}">${icon('trash')} удалить</button>
    </div>`;
}

function itemCard(item, i, type) {
  const problems = itemProblems(draft, item, i);
  const open = openItems.has(i);
  return `
  <div class="q-item ${open ? 'is-open' : ''}" data-i="${i}">
    <div class="q-head" data-act="toggleItem" data-i="${i}">
      <span class="q-num">${i + 1}</span>
      <span class="q-text">${esc(item.q || 'Без текста')}</span>
      <span class="q-badge ${problems.length ? 'is-warn' : 'is-ok'}">${problems.length ? esc(problems[0].what) : 'готово'}</span>
      ${icon(open ? 'chevron-up' : 'chevron-down')}
    </div>
    ${open ? `<div class="q-body">${itemBody(item, i, type)}</div>` : ''}
  </div>`;
}

// Поля, которые есть у любого конкурса, независимо от формата. Формат про них
// не знает, но рисуются и сохраняются они тем же механизмом, что и его
// собственные, — иначе «Музыка номера» не попала бы ни в один обработчик.
const COMMON_FIELDS = [
  { k: 'media', f: 'themeTrack', kind: 'audio', label: 'Музыка номера',
    hint: 'Заиграет сама, когда на экране появится афиша этого конкурса, и приглушится на вопросах.' }
];

function contestFields(type) {
  return COMMON_FIELDS.concat(type.fields || []);
}

function renderEditor() {
  const box = $('editor');
  if (!draft) {
    $('editorTitle').textContent = 'Конкурс';
    box.innerHTML = '<div class="muted">Выбери конкурс слева — или создай новый.</div>';
    return;
  }
  const type = getType(draft.type);
  $('editorTitle').textContent = `${type.label} · ${(draft.items || []).length} шт.`;
  box.innerHTML = `
    <div class="field-row">
      <div class="field" style="flex:0 0 11rem"><label>Подзаголовок</label>
        <input data-f="subtitle" value="${esc(draft.subtitle || '')}" placeholder="Номер первый"></div>
      <div class="field"><label>Название конкурса</label>
        <input data-f="title" value="${esc(draft.title || '')}"></div>
      <div class="field" style="flex:0 0 7rem"><label>Баллов за верный</label>
        <input type="number" min="0" max="10" data-f="pointsPerCorrect" value="${Number(draft.pointsPerCorrect) || 1}"></div>
      <div class="field" style="flex:0 0 7rem"><label>Множитель</label>
        <input type="number" min="1" max="5" data-f="multiplier" value="${Number(draft.multiplier) || 1}"></div>
    </div>
    <div class="muted" style="margin:-.3rem 0 .6rem">Множитель больше единицы — это «ва-банк»: на афише появится золотая плашка, а баллы за номер удвоятся.</div>
    <label class="mode-switch" style="margin-bottom:.6rem"><input type="checkbox" data-f="speedBonus" ${draft.speedBonus ? 'checked' : ''}> самому быстрому верному ответу — лишний балл</label>
    <div class="field"><label>Правила на афише</label>
      <textarea rows="2" data-f="rules">${esc(draft.rules || '')}</textarea></div>
    <div class="field"><label>Заметки ведущему — видны только в кабинете и на пульте</label>
      <textarea rows="3" data-f="hostNotes" placeholder="Что сказать, какой реквизит приготовить, какую музыку включить">${esc(draft.hostNotes || '')}</textarea></div>
    <div class="field"><label>Что скажет ${esc(names(state).lion)} на афише</label>
      <input data-f="lionLine" value="${esc(draft.lionLine || '')}"></div>

    ${renderFields(COMMON_FIELDS, draft, undefined, fieldApi(musicFiles))}
    ${renderFields(type.fields, draft, undefined, fieldApi())}

    <div class="section-title">Вопросы</div>
    <div id="itemsBox">${(draft.items || []).map((it, i) => itemCard(it, i, type)).join('')}</div>
    <button class="a-btn a-btn--primary a-btn--wide" data-act="addItem" style="margin-top:.5rem">
      ${icon('plus')} Добавить ${type.itemNoun || 'вопрос'}
    </button>
  `;
}

// ——— семьи ———

function ownerRow(o, kind) {
  const inner = isPhotoAvatar(o.avatar)
    ? photoAvatar(o.avatar)
    : hasAvatar(o.avatar)
      ? avatar(o.avatar)
      : `<span style="display:grid;place-items:center;width:100%;height:100%">${esc(o.emoji || '')}</span>`;
  const teamPicker = kind === 'guest' ? `
    <select class="team-in" data-g="${esc(o.id)}" data-gf="teamId">
      <option value="">— без семьи —</option>
      ${(state.teams || []).map((t) =>
    `<option value="${esc(t.id)}" ${t.id === o.teamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
    </select>` : '';
  return `
    <div class="g-line" data-owner="${esc(o.id)}">
      <button class="g-av" data-avatar="${esc(o.id)}" data-kind="${kind}"
              style="--c:${esc(o.color || '#ccc')}" title="Сменить зверя">${inner}</button>
      <input type="text" data-${kind === 'guest' ? 'g' : 't'}="${esc(o.id)}" data-gf="name" value="${esc(o.name)}">
      ${teamPicker}
      ${kind === 'guest'
    ? `<input type="checkbox" class="play-in" data-g="${esc(o.id)}" data-gf="playing"
             ${o.playing === false ? '' : 'checked'} title="Играет в конкурсах — выходит на арену и попадает в колесо">`
    : ''}
      <input type="color" class="color-in" data-${kind === 'guest' ? 'g' : 't'}="${esc(o.id)}" data-gf="color"
             value="${esc(o.color || '#E63946')}">
      ${kind === 'team' ? `<input type="number" class="score-in" data-t="${esc(o.id)}" data-gf="score" value="${o.score || 0}">` : ''}
      <button class="a-btn a-btn--sm a-btn--danger" data-${kind === 'guest' ? 'gdel' : 'tdel'}="${esc(o.id)}">${icon('trash')}</button>
    </div>`;
}

// Кто сейчас подключён с телефона. Один владелец может держать несколько
// телефонов — в семье их и правда несколько.
function renderPlayers() {
  const phones = (state.show.playMode === 'phones');
  $('modePhones').checked = phones;
  $('modeInterludes').checked = state.show.interludes !== false;
  $('modeEach').checked = state.show.answerMode === 'each';
  // Пока ведущий печатает, чужое состояние текст не перебивает.
  const pad = $('notebook');
  if (document.activeElement !== pad) pad.value = state.show.notebook || '';

  const players = Object.values((state.play && state.play.players) || {});
  const byId = {};
  for (const o of (state.teams || []).concat(state.guests || [])) byId[o.id] = o;

  $('playersBox').innerHTML = `
    <div class="muted" style="margin-bottom:.5rem">
      ${phones
    ? 'Гости отвечают со своих телефонов. QR-код для них показан на заставке.'
    : 'Сейчас праздник идёт только с твоего пульта. Включи галочку слева, чтобы раздать телефоны.'}
    </div>
    ${players.length
    ? players.map((p) => {
      const owner = byId[p.ownerId];
      return `<div class="g-line">
          <span class="nm" style="flex:1;font-weight:900">${esc(p.name || (owner ? owner.name : '—'))}</span>
          <span class="muted">${owner ? esc(owner.name) : 'отвязан'}</span>
          <button class="a-btn a-btn--sm a-btn--danger" data-kick="${esc(p.id)}">${icon('cross')}</button>
        </div>`;
    }).join('')
    : '<div class="muted">Пока никто не подключился.</div>'}`;
}

function renderTeams() {
  $('modeTeams').checked = (state.show.mode || 'teams') === 'teams';
  renderOwnerList($('teamList'), state.teams || [], 'team', 'Семей пока нет');
}

// Сохраняем сами DOM-узлы полей при ответах сервера: фокус, выделение,
// промежуточный ввод и незавершённая композиция текста остаются на месте.
function renderOwnerList(container, list, kind, emptyText) {
  const existing = new Map([...container.querySelectorAll('[data-owner]')].map((row) => [row.dataset.owner, row]));
  if (!list.length) { container.innerHTML = `<div class="muted">${emptyText}</div>`; return; }
  if (!existing.size) container.replaceChildren();
  list.forEach((owner, index) => {
    const template = document.createElement('template');
    template.innerHTML = ownerRow(owner, kind);
    const fresh = template.content.firstElementChild;
    const row = existing.get(owner.id) || fresh;
    if (row !== fresh) {
      [...fresh.children].forEach((next, childIndex) => {
        const node = row.children[childIndex];
        if (node === document.activeElement) return;
        if (node.tagName === 'INPUT') {
          if (node.type === 'checkbox') {
            if (node.checked !== next.checked) node.checked = next.checked;
          } else if (node.value !== next.value) node.value = next.value;
        } else {
          if (node.innerHTML !== next.innerHTML) node.innerHTML = next.innerHTML;
          if (node.tagName === 'SELECT') node.value = next.value;
          if (node.getAttribute('style') !== next.getAttribute('style')) {
            if (next.hasAttribute('style')) node.setAttribute('style', next.getAttribute('style'));
            else node.removeAttribute('style');
          }
        }
      });
    }
    if (container.children[index] !== row) container.insertBefore(row, container.children[index] || null);
    existing.delete(owner.id);
  });
  for (const row of existing.values()) row.remove();
}

// ——— гости ———

function renderGuests() {
  renderOwnerList($('guestList'), state.guests, 'guest', 'Гостей пока нет');
}

// ——— медиа ———

function renderMedia() {
  $('mediaList').innerHTML = media.map((f) => `
    <div class="media-cell">
      ${f.kind === 'photo'
    ? `<img src="${esc(f.path)}" alt="">`
    : `<div class="ph">${icon(f.kind === 'video' ? 'clapper' : 'music')}</div>`}
      ${esc(f.name)}
    </div>`).join('') || '<div class="muted">Файлов пока нет</div>';
}

function loadMedia() {
  return fetch('/api/media').then((r) => r.json()).then((data) => {
    // sfx/ и music/ — служебные звуки показа, в конкурсах они не нужны.
    const all = data.files || [];
    media = all.filter((f) => !/^(sfx|music)\//.test(f.name || ''));
    // Для «Музыки номера» годится всё, кроме служебных звуков клоуна.
    musicFiles = all.filter((f) => f.kind === 'audio' && !/^sfx\//.test(f.name || ''));
    renderMedia();
    if (draft) renderEditor();
  });
}

function upload(files) {
  const bar = $('uploadBar');
  const fill = bar.querySelector('span');
  bar.classList.add('is-on');
  const list = Array.from(files);
  let done = 0;
  const step = () => {
    const file = list[done];
    if (!file) {
      bar.classList.remove('is-on');
      fill.style.width = '0';
      loadMedia();
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload?name=' + encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      const pct = ((done + e.loaded / (e.total || 1)) / list.length) * 100;
      fill.style.width = pct.toFixed(1) + '%';
    };
    xhr.onload = () => { done++; step(); };
    xhr.onerror = () => { done++; step(); };
    xhr.send(file);
  };
  step();
}

// ——— выбор картинки или зверя ———

function openPicker(kind, onPick, selected = '') {
  picker = { kind, onPick, selected, opener: document.activeElement };
  $('pickerTitle').textContent = kind === 'photo' ? 'Выбери фотографию' : kind === 'avatar' ? 'Выбери зверя' : 'Выбери картинку';
  $('pickerGrid').classList.toggle('photo-grid', kind === 'photo');
  $('pickerSearch').value = '';
  $('pickerSearch').style.display = '';
  renderPicker('');
  $('pickerBack').classList.add('is-open');
  $('pickerSearch').focus();
}

function renderPicker(query) {
  const q = (query || '').trim().toLowerCase();
  let cells;
  if (picker.kind === 'photo') {
    cells = media.filter((f) => f.kind === 'photo' && (!q || f.name.toLowerCase().includes(q)))
      .map((f) => `<button type="button" class="cell photo-cell ${f.path === picker.selected ? 'is-selected' : ''}" data-value="${esc(f.path)}" aria-pressed="${f.path === picker.selected}">
        <img src="${esc(f.path)}" alt="" loading="lazy"><span>${esc(f.name)}</span>
        ${f.path === picker.selected ? '<small>Выбрано ✓</small>' : ''}</button>`);
    if (!cells.length) cells.push(`<div class="muted">${q ? 'Фотографий с таким названием нет.' : 'Фотографий пока нет. Загрузи их в разделе «Медиа» внизу страницы.'}</div>`);
  } else if (picker.kind === 'avatar') {
    cells = AVATAR_IDS.filter((id) => !q || id.includes(q) || AVATAR_LABELS[id].toLowerCase().includes(q)).map((id) =>
      `<button type="button" class="cell" data-value="${id}">${avatar(id)}${esc(AVATAR_LABELS[id])}</button>`);
    // Свои картинки — сразу после зверей: портрет гостя или зверь, сделанный
    // из его лица. Кладутся в «Медиа» как обычные фотографии.
    const photos = media.filter((f) => f.kind === 'photo' && (!q || f.name.toLowerCase().includes(q)));
    cells.push(...photos.map((f) =>
      `<button type="button" class="cell" data-value="${esc(f.path)}"><img class="av-photo-pick" src="${esc(f.path)}" alt="" loading="lazy">${esc(f.name)}</button>`));
  } else {
    cells = ART_NAMES
      .filter((n) => !q || n.includes(q) || (ART_LABELS[n] || '').toLowerCase().includes(q))
      .map((n) => `<button type="button" class="cell" data-value="${n}">${art(n)}${esc(ART_LABELS[n])}</button>`);
    cells.unshift('<button type="button" class="cell is-clear" data-value="">без картинки</button>');
  }
  $('pickerGrid').innerHTML = cells.join('') || '<div class="muted">Ничего не нашлось</div>';
}

function closePicker() {
  $('pickerBack').classList.remove('is-open');
  picker?.opener?.focus();
  picker = null;
}

// ——— события редактора ———

function currentItem(i) { return draft.items[Number(i)]; }

// Шапка вопроса — текст и значок «готово». Обновляем её на лету, пока ведущий
// печатает: перерисовывать всё поле нельзя, иначе прыгает курсор.
function refreshItemHead(i) {
  if (i === undefined) return;
  const head = document.querySelector(`.q-item[data-i="${i}"] .q-head`);
  const item = currentItem(i);
  if (!head || !item) return;
  const text = head.querySelector('.q-text');
  if (text) text.textContent = item.q || 'Без текста';
  const badge = head.querySelector('.q-badge');
  if (!badge) return;
  const list = itemProblems(draft, item, Number(i));
  badge.textContent = list.length ? list[0].what : 'готово';
  badge.classList.toggle('is-warn', list.length > 0);
  badge.classList.toggle('is-ok', list.length === 0);
}

// Ролик с iPhone в HEVC браузер открывает, но картинку не декодирует: ширина
// кадра остаётся нулевой. Предупреждаем прямо под плеером — на празднике
// будет поздно.
$('editor').addEventListener('loadedmetadata', (e) => {
  const v = e.target;
  if (!v.classList || !v.classList.contains('vid-preview')) return;
  const warn = v.parentElement && v.parentElement.querySelector('.vid-nopic');
  if (warn) warn.hidden = v.videoWidth > 0;
}, true);

$('editor').addEventListener('input', (e) => {
  const t = e.target;
  if (!draft) return;

  // Поля, которые есть у любого конкурса, кабинет держит у себя.
  if (!t.dataset.fk) {
    const f = t.dataset.f;
    if (!f) return;
    const numeric = f === 'pointsPerCorrect' || f === 'multiplier';
    draft[f] = t.type === 'checkbox' ? t.checked : numeric ? Number(t.value) : t.value;
    if (f === 'multiplier') renderList();
    scheduleSave();
    if (f === 'title') renderList();
    return;
  }

  // Остальное — поля формата: у вопроса есть data-i, у конкурса нет.
  const i = t.dataset.i;
  const type = getType(draft.type);
  const list = i === undefined ? contestFields(type) : type.itemFields;
  const target = i === undefined ? draft : currentItem(i);
  if (!target || !applyInput(list, t, target)) return;
  scheduleSave();
  if (needsRerender(list, t)) renderEditor();
  else refreshItemHead(i);
  renderReady();
});

$('editor').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || !draft) return;
  const act = btn.dataset.act;
  const i = btn.dataset.i;
  const type = getType(draft.type);

  // Кнопки самого кабинета: раскрыть, добавить, удалить, переставить вопрос.
  if (act === 'toggleItem') {
    const idx = Number(i);
    if (openItems.has(idx)) openItems.delete(idx); else openItems.add(idx);
    renderEditor();
    return;
  }
  if (act === 'addItem') {
    const fresh = type.newItem ? type.newItem(names(state)) : { id: '', q: 'Новый вопрос' };
    fresh.id = 'i-' + Math.random().toString(36).slice(2, 8);
    draft.items.push(fresh);
    openItems.add(draft.items.length - 1);
    return done();
  }
  if (act === 'delItem') {
    draft.items.splice(Number(i), 1);
    openItems.delete(Number(i));
    return done();
  }
  if (act === 'moveItem') {
    const from = Number(i);
    const to = from + Number(btn.dataset.dir);
    if (to < 0 || to >= draft.items.length) return;
    const [it] = draft.items.splice(from, 1);
    draft.items.splice(to, 0, it);
    openItems = new Set([to]);
    return done();
  }

  // Всё остальное — кнопки полей формата.
  if (!btn.dataset.fk) return;
  const list = i === undefined ? contestFields(type) : type.itemFields;
  const target = i === undefined ? draft : currentItem(i);
  if (!target) return;
  if (applyClick(list, btn, target, fieldApi()) === 'changed') done();
});

// После правки: перерисовать, пересчитать готовность и сохранить.
function done() {
  renderEditor();
  renderList();
  renderReady();
  saveNow();
}

// ——— список, готовность, гости ———

$('readyBox').addEventListener('click', (e) => {
  const fix = e.target.closest('[data-fix]');
  if (fix) selectContest(fix.dataset.fix, Number(fix.dataset.index));
});

$('contestList').addEventListener('click', (e) => {
  const move = e.target.closest('[data-move]');
  if (move) { bus.send('moveContest', { id: move.dataset.move, dir: Number(move.dataset.dir) }); return; }
  const toggle = e.target.closest('[data-toggle]');
  if (toggle) { bus.send('toggleContest', { id: toggle.dataset.toggle }); return; }
  const del = e.target.closest('[data-del]');
  if (del) {
    const c = state.show.contests.find((x) => x.id === del.dataset.del);
    if (!confirm(`Удалить конкурс «${c ? c.title : ''}» вместе со всеми вопросами?`)) return;
    if (selectedId === del.dataset.del) { selectedId = null; draft = null; renderEditor(); }
    bus.send('deleteContest', { id: del.dataset.del });
    return;
  }
  const pick = e.target.closest('[data-pick]');
  if (pick) selectContest(pick.dataset.pick, -1);
});

$('btnAddContest').addEventListener('click', () => {
  const type = getType($('newType').value);
  // Общее у всех конкурсов задаёт кабинет, своё добавляет формат.
  const contest = Object.assign({
    subtitle: 'Новый номер',
    title: type.label,
    rules: '',
    lionLine: '',
    pointsPerCorrect: 1,
    items: []
  }, type.newContest ? type.newContest(names(state)) : {});
  contest.id = 'c-' + Math.random().toString(36).slice(2, 8);
  contest.type = type.id;
  contest.enabled = true;

  bus.send('saveContest', { contest }).then(() => {
    selectedId = contest.id;
    draft = JSON.parse(JSON.stringify(contest));
    openItems = new Set();
    renderEditor();
  });
});

$('teamList').addEventListener('input', (e) => {
  const t = e.target;
  if (!t.dataset.t) return;
  const field = t.dataset.gf;
  if (field === 'score') bus.send('setScore', { id: t.dataset.t, score: Number(t.value) });
  else bus.send('updateTeam', { id: t.dataset.t, [field]: t.value });
  markSaved();
});

$('teamList').addEventListener('click', (e) => {
  const av = e.target.closest('[data-avatar]');
  if (av) {
    const id = av.dataset.avatar;
    openPicker('avatar', (value) => bus.send('updateTeam', { id, avatar: value }).then(markSaved));
    return;
  }
  const del = e.target.closest('[data-tdel]');
  if (!del) return;
  const team = (state.teams || []).find((x) => x.id === del.dataset.tdel);
  if (confirm(`Удалить семью «${team ? team.name : ''}»? Гости останутся, просто без семьи.`)) {
    bus.send('removeTeam', { id: del.dataset.tdel });
  }
});

$('btnAddTeam').addEventListener('click', () => {
  const input = $('newTeamName');
  if (!input.value.trim()) return;
  bus.send('addTeam', { name: input.value.trim() });
  input.value = '';
});
$('newTeamName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnAddTeam').click(); });

$('modeInterludes').addEventListener('change', (e) => {
  bus.send('updateShow', { patch: { interludes: e.target.checked } });
  markSaved();
});

// Блокнот сохраняем с задержкой — он длинный, и писать в него будут долго.
let notebookTimer = 0;
$('notebook').addEventListener('input', () => {
  clearTimeout(notebookTimer);
  $('notebookSaved').textContent = 'печатаю…';
  notebookTimer = setTimeout(() => {
    bus.send('setNotebook', { text: $('notebook').value })
      .then(() => { $('notebookSaved').textContent = 'сохранено'; });
  }, 600);
});

$('modeEach').addEventListener('change', (e) => {
  bus.send('setAnswerMode', { mode: e.target.checked ? 'each' : 'family' }).then(markSaved);
});

$('modePhones').addEventListener('change', (e) => {
  bus.send('setPlayMode', { mode: e.target.checked ? 'phones' : 'host' });
  markSaved();
});

$('playersBox').addEventListener('click', (e) => {
  const kick = e.target.closest('[data-kick]');
  if (kick) bus.send('kickPlayer', { playerId: kick.dataset.kick });
});

$('modeTeams').addEventListener('change', (e) => {
  bus.send('setMode', { mode: e.target.checked ? 'teams' : 'guests' }).then(markSaved);
});

$('guestList').addEventListener('input', (e) => {
  const t = e.target;
  if (!t.dataset.g) return;
  const field = t.dataset.gf;
  if (field === 'score') bus.send('setScore', { id: t.dataset.g, score: Number(t.value) });
  else bus.send('updateGuest', { id: t.dataset.g, [field]: t.type === 'checkbox' ? t.checked : t.value });
  markSaved();
});

$('guestList').addEventListener('click', (e) => {
  const av = e.target.closest('[data-avatar]');
  if (av) {
    const id = av.dataset.avatar;
    openPicker('avatar', (value) => bus.send('updateGuest', { id, avatar: value }).then(markSaved));
    return;
  }
  const del = e.target.closest('[data-gdel]');
  if (!del) return;
  const g = state.guests.find((x) => x.id === del.dataset.gdel);
  if (confirm(`Удалить гостя «${g ? g.name : ''}»?`)) bus.send('removeGuest', { id: del.dataset.gdel });
});

$('btnAddGuest').addEventListener('click', () => {
  const input = $('newGuestName');
  if (!input.value.trim()) return;
  bus.send('addGuest', { name: input.value.trim() });
  input.value = '';
});
$('newGuestName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnAddGuest').click(); });

$('btnResetScores').addEventListener('click', () => {
  if (confirm('Обнулить баллы у всех гостей?')) bus.send('resetScores');
});

for (const id of ['showHero', 'showHeroShort', 'showLion', 'showTitle', 'showAge']) {
  $(id).addEventListener('input', () => {
    bus.send('updateShow', {
      patch: {
        hero: $('showHero').value,
        heroShort: $('showHeroShort').value,
        lion: $('showLion').value,
        title: $('showTitle').value,
        age: Number($('showAge').value)
      }
    });
    markSaved();
  });
}

$('btnRehearsal').addEventListener('click', () => {
  const on = !state.runtime.rehearsal;
  bus.send('rehearsal', { on });
});

// ——— выбор картинки ———

$('pickerBack').addEventListener('click', (e) => {
  if (e.target === $('pickerBack')) { closePicker(); return; }
  const cell = e.target.closest('[data-value]');
  if (cell && picker) {
    const cb = picker.onPick;
    closePicker();
    cb(cell.dataset.value);
  }
});
$('pickerClose').addEventListener('click', closePicker);
$('pickerSearch').addEventListener('input', (e) => renderPicker(e.target.value));
document.addEventListener('keydown', (e) => {
  if (!picker) return;
  if (e.key === 'Escape') { closePicker(); return; }
  if (e.key === 'Tab') {
    const items = [...$('pickerBack').querySelectorAll('button, input, [tabindex="0"]')].filter((node) => node.getClientRects().length);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }
});

// ——— медиа: загрузка ———

$('btnPickFile').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', (e) => { if (e.target.files.length) upload(e.target.files); e.target.value = ''; });

const dz = $('dropZone');
['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => {
  e.preventDefault();
  dz.classList.add('is-over');
}));
['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => {
  e.preventDefault();
  dz.classList.remove('is-over');
}));
dz.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) upload(e.dataTransfer.files); });

// ——— бэкап ———

$('btnExport').addEventListener('click', () => {
  const data = JSON.stringify({ show: state.show, guests: state.guests, teams: state.teams }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = 'cirk-timoshi-backup.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('btnImport').addEventListener('click', () => $('importInput').click());
$('importInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  file.text().then((text) => {
    let data;
    try { data = JSON.parse(text); } catch (err) { alert('Это не похоже на файл бэкапа'); return; }
    if (!confirm('Заменить всю программу и гостей содержимым файла?')) return;
    bus.send('importShow', { show: data.show, guests: data.guests, teams: data.teams }).then(() => {
      selectedId = null;
      draft = null;
      renderEditor();
    });
  });
  e.target.value = '';
});

// ——— запуск ———

mountSprite();
mountArtSprite();
mountAvatarSprite();

$('brand').insertAdjacentHTML('afterbegin', icon('tent'));
$('icList').innerHTML = icon('list');
$('icUsers').innerHTML = icon('users');
$('icTeams').innerHTML = icon('home');
$('icSettings').innerHTML = icon('settings');
$('icPlayers').innerHTML = icon('phone');
$('icNotebook').innerHTML = icon('edit');
$('icCheck').innerHTML = icon('check-circle');
$('icEdit').innerHTML = icon('edit');
$('icFile').innerHTML = icon('file');
$('newType').innerHTML = types().map((t) => `<option value="${t.id}">${t.label}</option>`).join('');

bus.onState((next) => {
  const first = !state;
  state = next;
  renderList();
  renderTeams();
  renderGuests();
  renderReady();
  renderPlayers();
  $('btnRehearsal').classList.toggle('a-btn--primary', !!state.runtime.rehearsal);
  $('btnRehearsal').textContent = state.runtime.rehearsal ? 'Закончить репетицию' : 'Репетиция';
  const n = names(state);
  const fields = { showHero: n.hero, showHeroShort: n.short, showLion: n.lion, showTitle: n.title, showAge: n.age };
  for (const id of Object.keys(fields)) {
    // Поле, в котором сейчас печатают, не трогаем — иначе курсор прыгает.
    if (document.activeElement !== $(id)) $(id).value = fields[id];
  }
  document.title = 'Кабинет · ' + n.title;
  $('brand').lastChild.textContent = n.title + ' · кабинет';
  if (first) {
    const firstContest = (state.show.contests || [])[0];
    if (firstContest) selectContest(firstContest.id, -1);
  }
});
bus.start('admin');
loadMedia();
