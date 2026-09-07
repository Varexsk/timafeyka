// Кабинет: конкурсы, вопросы, гости, медиа. Всё сохраняется на сервер сразу.

import * as bus from './bus.js';
import { types, getType, loadTypes } from './engine/registry.js';
import { esc, names } from './util.js';
import { mountSprite, icon } from './icons.js';
import { mountArtSprite, art, hasArt, ART_NAMES, ART_LABELS } from './art.js';
import { mountAvatarSprite, avatar, hasAvatar, AVATAR_IDS, AVATAR_LABELS } from './avatars.js';

await loadTypes();

const $ = (id) => document.getElementById(id);

let state = null;
let draft = null;        // копия редактируемого конкурса
let selectedId = null;
let media = [];
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
  const ed = type.editor || {};
  const out = [];
  if (ed.numberAnswer) {
    const empty = item.value === null || item.value === undefined || item.value === '';
    if (empty) out.push('не заполнено правильное число');
  } else if (!ed.noAnswer) {
    const hasOption = Number.isInteger(item.answer);
    const hasText = !!(item.answerText || '').trim();
    if (!hasOption && !hasText) out.push('не отмечен правильный ответ');
  }
  if (ed.media === 'photo' && type.id === 'photoGuess' && !item.media) out.push('нет фото');
  if (ed.media === 'audio' && !item.audio) out.push('нет аудио');
  if (ed.marks && !(Number(item.at) > 0)) out.push('не проставлена метка паузы');
  return out.map((what) => ({ contestId: contest.id, title: contest.title, index: i, what }));
}

function allProblems() {
  const out = [];
  for (const c of (state.show.contests || [])) {
    if (c.enabled === false) continue;
    const type = getType(c.type);
    if ((type.editor || {}).contestVideo && !c.video) {
      out.push({ contestId: c.id, title: c.title, index: -1, what: 'не выбрано видео конкурса' });
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
  const type = getType(c.type);
  if ((type.editor || {}).contestVideo && !c.video) return false;
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

function mediaOptions(kind, current) {
  const files = media.filter((f) => f.kind === kind);
  return '<option value="">— не выбрано —</option>' + files.map((f) =>
    `<option value="${esc(f.path)}" ${f.path === current ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
}

function iconSlot(o, i, oi) {
  const inner = o.icon && hasArt(o.icon)
    ? art(o.icon)
    : (o.emoji ? `<span>${esc(o.emoji)}</span>` : '<span class="empty">нет</span>');
  return `<button class="icon-slot" data-act="pickIcon" data-i="${i}" data-o="${oi}" title="Выбрать картинку">${inner}</button>`;
}

function optionRows(item, i, type) {
  const opts = item.options || [];
  return `
    <div class="muted" style="margin:.5rem 0 .3rem">Варианты ответа — отметь правильный</div>
    ${opts.map((o, oi) => `
      <div class="opt-row">
        <button class="opt-mark ${item.answer === oi ? 'is-on' : ''}" data-act="mark" data-i="${i}" data-o="${oi}"
                title="Это правильный ответ">${icon('check')}</button>
        ${iconSlot(o, i, oi)}
        <input data-f="optText" data-i="${i}" data-o="${oi}" value="${esc(o.text || '')}" placeholder="Текст варианта">
        <button class="a-btn a-btn--sm" data-act="delOpt" data-i="${i}" data-o="${oi}" title="Убрать">${icon('cross')}</button>
      </div>`).join('')}
    <div style="display:flex;gap:.4rem;margin-top:.35rem;flex-wrap:wrap">
      <button class="a-btn a-btn--sm" data-act="addOpt" data-i="${i}">${icon('plus')} вариант</button>
      ${type.editor.guestOptions ? `<button class="a-btn a-btn--sm" data-act="fillGuests" data-i="${i}">Подставить гостей</button>` : ''}
      ${opts.length ? `<button class="a-btn a-btn--sm" data-act="clearOpts" data-i="${i}">Сделать открытым вопросом</button>` : ''}
    </div>`;
}

function itemBody(item, i, type) {
  const ed = type.editor || {};
  const opts = item.options || [];
  return `
    <div class="field">
      <label>${ed.noAnswer ? 'Задание' : 'Вопрос'}</label>
      <textarea rows="2" data-f="q" data-i="${i}">${esc(item.q || '')}</textarea>
    </div>

    ${ed.trueFalse ? `
      <div class="field">
        <label>Это правда или ложь?</label>
        <div style="display:flex;gap:.4rem">
          <button class="a-btn ${item.answer === 0 ? 'a-btn--primary' : ''}" data-act="tf" data-i="${i}" data-v="0">Правда</button>
          <button class="a-btn ${item.answer === 1 ? 'a-btn--primary' : ''}" data-act="tf" data-i="${i}" data-v="1">Ложь</button>
        </div>
      </div>` : ''}

    ${ed.numberAnswer ? `
      <div class="field-row">
        <div class="field"><label>Правильное число</label>
          <input type="number" step="any" data-f="value" value="${item.value === null || item.value === undefined ? '' : esc(item.value)}"
                 data-i="${i}" placeholder="например 3250"></div>
        <div class="field" style="flex:0 0 8rem"><label>Единицы</label>
          <input data-f="unit" data-i="${i}" value="${esc(item.unit || '')}" placeholder="г, см, шт"></div>
      </div>` : ''}

    ${ed.options ? optionRows(item, i, type) : ''}

    ${ed.openAnswer && !opts.length ? `
      <div class="field" style="margin-top:.6rem">
        <label>Правильный ответ — покажется крупно на экране</label>
        <input data-f="answerText" data-i="${i}" value="${esc(item.answerText || '')}" placeholder="Например: «Мама»">
      </div>` : ''}

    ${ed.media === 'photo' ? `
      <div class="field">
        <label>Фото</label>
        <select data-f="media" data-i="${i}">${mediaOptions('photo', item.media)}</select>
        ${item.media ? `<img class="media-preview" src="${esc(item.media)}" alt="">` : ''}
      </div>` : ''}

    ${ed.media === 'audio' ? `
      <div class="field">
        <label>Аудио</label>
        <select data-f="audio" data-i="${i}">${mediaOptions('audio', item.audio)}</select>
        ${item.audio ? `<audio controls src="${esc(item.audio)}" style="width:100%;margin-top:.4rem"></audio>` : ''}
      </div>` : ''}

    ${ed.marks ? `
      <div class="marks-row">
        <div class="field"><label>Пауза на секунде</label>
          <input type="number" step="0.1" style="width:7rem" data-f="at" data-i="${i}" value="${Number(item.at) || 0}"></div>
        <button class="a-btn a-btn--sm" data-act="grabAt" data-i="${i}">${icon('clock')} с плеера</button>
        <div class="field"><label>Доиграть до</label>
          <input type="number" step="0.1" style="width:7rem" data-f="revealEnd" data-i="${i}" value="${Number(item.revealEnd) || 0}"></div>
        <button class="a-btn a-btn--sm" data-act="grabEnd" data-i="${i}">${icon('clock')} с плеера</button>
        <button class="a-btn a-btn--sm" data-act="seek" data-i="${i}">${icon('play')} проверить</button>
      </div>` : ''}

    <div class="field" style="margin-top:.6rem">
      <label>Приписка к ответу (необязательно)</label>
      <input data-f="answerNote" data-i="${i}" value="${esc(item.answerNote || '')}" placeholder="Например: «Ровно в обед!»">
    </div>

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

function renderEditor() {
  const box = $('editor');
  if (!draft) {
    $('editorTitle').textContent = 'Конкурс';
    box.innerHTML = '<div class="muted">Выбери конкурс слева — или создай новый.</div>';
    return;
  }
  const type = getType(draft.type);
  const ed = type.editor || {};
  $('editorTitle').textContent = `${type.label} · ${(draft.items || []).length} шт.`;
  box.innerHTML = `
    <div class="field-row">
      <div class="field" style="flex:0 0 11rem"><label>Подзаголовок</label>
        <input data-f="subtitle" value="${esc(draft.subtitle || '')}" placeholder="Номер первый"></div>
      <div class="field"><label>Название конкурса</label>
        <input data-f="title" value="${esc(draft.title || '')}"></div>
      <div class="field" style="flex:0 0 7rem"><label>Баллов за верный</label>
        <input type="number" min="0" max="10" data-f="pointsPerCorrect" value="${Number(draft.pointsPerCorrect) || 1}"></div>
    </div>
    <div class="field"><label>Правила на афише</label>
      <textarea rows="2" data-f="rules">${esc(draft.rules || '')}</textarea></div>
    <div class="field"><label>Что скажет ${esc(names(state).lion)} на афише</label>
      <input data-f="lionLine" value="${esc(draft.lionLine || '')}"></div>

    ${ed.contestVideo ? `
      <div class="field">
        <label>Видео конкурса</label>
        <select data-f="video">${mediaOptions('video', draft.video)}</select>
        ${draft.video
          ? `<video class="vid-preview" id="vidPrev" src="${esc(draft.video)}" controls preload="metadata" style="margin-top:.4rem"></video>
             <div class="muted" style="margin-top:.3rem">Поставь видео на нужном моменте и жми «с плеера» у вопроса.</div>`
          : '<div class="muted" style="margin-top:.3rem">Загрузи видео ниже — потом выбери его здесь.</div>'}
      </div>` : ''}

    <div class="section-title">Вопросы</div>
    <div id="itemsBox">${(draft.items || []).map((it, i) => itemCard(it, i, type)).join('')}</div>
    <button class="a-btn a-btn--primary a-btn--wide" data-act="addItem" style="margin-top:.5rem">
      ${icon('plus')} Добавить ${ed.noAnswer ? 'задание' : 'вопрос'}
    </button>
  `;
}

// ——— семьи ———

function ownerRow(o, kind) {
  const inner = hasAvatar(o.avatar)
    ? avatar(o.avatar)
    : `<span style="display:grid;place-items:center;width:100%;height:100%">${esc(o.emoji || '')}</span>`;
  const teamPicker = kind === 'guest' ? `
    <select class="team-in" data-g="${esc(o.id)}" data-gf="teamId">
      <option value="">— без семьи —</option>
      ${(state.teams || []).map((t) =>
    `<option value="${esc(t.id)}" ${t.id === o.teamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
    </select>` : '';
  return `
    <div class="g-line">
      <button class="g-av" data-avatar="${esc(o.id)}" data-kind="${kind}"
              style="--c:${esc(o.color || '#ccc')}" title="Сменить зверя">${inner}</button>
      <input type="text" data-${kind === 'guest' ? 'g' : 't'}="${esc(o.id)}" data-gf="name" value="${esc(o.name)}">
      ${teamPicker}
      <input type="color" class="color-in" data-${kind === 'guest' ? 'g' : 't'}="${esc(o.id)}" data-gf="color"
             value="${esc(o.color || '#E63946')}">
      ${kind === 'team' ? `<input type="number" class="score-in" data-t="${esc(o.id)}" data-gf="score" value="${o.score || 0}">` : ''}
      <button class="a-btn a-btn--sm a-btn--danger" data-${kind === 'guest' ? 'gdel' : 'tdel'}="${esc(o.id)}">${icon('trash')}</button>
    </div>`;
}

function renderTeams() {
  $('modeTeams').checked = (state.show.mode || 'teams') === 'teams';
  $('teamList').innerHTML = (state.teams || []).map((t) => ownerRow(t, 'team')).join('')
    || '<div class="muted">Семей пока нет</div>';
}

// ——— гости ———

function renderGuests() {
  $('guestList').innerHTML = state.guests.map((g) => ownerRow(g, 'guest')).join('')
    || '<div class="muted">Гостей пока нет</div>';
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
    media = (data.files || []).filter((f) => !/^(sfx|music)\//.test(f.name || ''));
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

function openPicker(kind, onPick) {
  picker = { kind, onPick };
  $('pickerTitle').textContent = kind === 'avatar' ? 'Выбери зверя' : 'Выбери картинку';
  $('pickerSearch').value = '';
  $('pickerSearch').style.display = kind === 'avatar' ? 'none' : '';
  renderPicker('');
  $('pickerBack').classList.add('is-open');
  if (kind !== 'avatar') $('pickerSearch').focus();
}

function renderPicker(query) {
  const q = (query || '').trim().toLowerCase();
  let cells;
  if (picker.kind === 'avatar') {
    cells = AVATAR_IDS.map((id) =>
      `<div class="cell" data-value="${id}">${avatar(id)}${esc(AVATAR_LABELS[id])}</div>`);
  } else {
    cells = ART_NAMES
      .filter((n) => !q || n.includes(q) || (ART_LABELS[n] || '').includes(q))
      .map((n) => `<div class="cell" data-value="${n}">${art(n)}${esc(n)}</div>`);
    cells.unshift('<div class="cell is-clear" data-value="">без картинки</div>');
  }
  $('pickerGrid').innerHTML = cells.join('') || '<div class="muted">Ничего не нашлось</div>';
}

function closePicker() {
  $('pickerBack').classList.remove('is-open');
  picker = null;
}

// ——— события редактора ———

function currentItem(i) { return draft.items[Number(i)]; }

$('editor').addEventListener('input', (e) => {
  const t = e.target;
  const f = t.dataset.f;
  if (!f || !draft) return;
  const i = t.dataset.i;
  const o = t.dataset.o;

  if (i === undefined) {
    draft[f] = f === 'pointsPerCorrect' ? Number(t.value) : t.value;
    if (f === 'video') renderEditor();
    scheduleSave();
    if (f === 'title') renderList();
    return;
  }
  const item = currentItem(i);
  if (!item) return;
  if (o !== undefined) {
    item.options = item.options || [];
    const opt = item.options[Number(o)] || (item.options[Number(o)] = { text: '', icon: '' });
    if (f === 'optText') opt.text = t.value;
  } else if (f === 'at' || f === 'revealEnd') {
    item[f] = Number(t.value) || 0;
  } else if (f === 'value') {
    item.value = t.value === '' ? null : Number(t.value);
  } else {
    item[f] = t.value;
    if (f === 'media' || f === 'audio') renderEditor();
  }
  scheduleSave();
  renderReady();
});

$('editor').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || !draft) return;
  const act = btn.dataset.act;
  const i = btn.dataset.i;
  const item = i === undefined ? null : currentItem(i);
  const type = getType(draft.type);
  const vid = $('vidPrev');

  if (act === 'toggleItem') {
    const idx = Number(i);
    if (openItems.has(idx)) openItems.delete(idx); else openItems.add(idx);
    renderEditor();
    return;
  }
  if (act === 'pickIcon' && item) {
    const oi = Number(btn.dataset.o);
    openPicker('art', (value) => {
      item.options[oi].icon = value;
      delete item.options[oi].emoji;
      renderEditor();
      saveNow();
    });
    return;
  }
  if (act === 'seek' && item && vid) {
    vid.currentTime = Number(item.at) || 0;
    vid.play().catch(() => {});
    return;
  }

  if (act === 'mark' && item) {
    const o = Number(btn.dataset.o);
    item.answer = item.answer === o ? null : o;
  } else if (act === 'tf' && item) {
    const v = Number(btn.dataset.v);
    item.answer = item.answer === v ? null : v;
  } else if (act === 'addOpt' && item) {
    item.options = item.options || [];
    item.options.push({ text: '', icon: '' });
  } else if (act === 'delOpt' && item) {
    const o = Number(btn.dataset.o);
    item.options.splice(o, 1);
    if (item.answer === o) item.answer = null;
    else if (Number.isInteger(item.answer) && item.answer > o) item.answer -= 1;
  } else if (act === 'clearOpts' && item) {
    item.options = [];
    item.answer = null;
  } else if (act === 'fillGuests' && item) {
    item.options = state.guests.map((g) => ({ text: g.name, icon: '' }));
    item.answer = null;
  } else if (act === 'addItem') {
    const fresh = type.newItem ? type.newItem(names(state)) : { id: '', q: 'Новый вопрос' };
    fresh.id = 'i-' + Math.random().toString(36).slice(2, 8);
    draft.items.push(fresh);
    openItems.add(draft.items.length - 1);
  } else if (act === 'delItem' && item) {
    draft.items.splice(Number(i), 1);
    openItems.delete(Number(i));
  } else if (act === 'moveItem') {
    const from = Number(i);
    const to = from + Number(btn.dataset.dir);
    if (to < 0 || to >= draft.items.length) return;
    const [it] = draft.items.splice(from, 1);
    draft.items.splice(to, 0, it);
    openItems = new Set([to]);
  } else if (act === 'grabAt' && item && vid) {
    item.at = Math.round(vid.currentTime * 10) / 10;
  } else if (act === 'grabEnd' && item && vid) {
    item.revealEnd = Math.round(vid.currentTime * 10) / 10;
  } else {
    return;
  }
  renderEditor();
  renderList();
  renderReady();
  saveNow();
});

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
  const contest = {
    id: 'c-' + Math.random().toString(36).slice(2, 8),
    type: type.id,
    enabled: true,
    subtitle: 'Новый номер',
    title: type.label,
    rules: '',
    lionLine: '',
    pointsPerCorrect: 1,
    items: []
  };
  if (type.id === 'videoChoice') contest.video = '';
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

$('modeTeams').addEventListener('change', (e) => {
  bus.send('setMode', { mode: e.target.checked ? 'teams' : 'guests' }).then(markSaved);
});

$('guestList').addEventListener('input', (e) => {
  const t = e.target;
  if (!t.dataset.g) return;
  const field = t.dataset.gf;
  if (field === 'score') bus.send('setScore', { id: t.dataset.g, score: Number(t.value) });
  else bus.send('updateGuest', { id: t.dataset.g, [field]: t.value });
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });

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
bus.start();
loadMedia();
