// Редактор вопроса собирается из описаний полей, которые даёт сам формат.
//
// Кабинет больше не знает, что такое «викторина» или «ставки». Он умеет
// рисовать текст, число, варианты ответа, выбор из двух, медиафайл и метки
// на видео — а какие из них показать, решает модуль формата.
//
// Описание поля:
//   { k: 'text', f: 'answerText', label: '…', placeholder: '…', width: '8rem',
//     when: (item, contest, state) => Boolean,   // показывать ли вообще
//     required: 'нет фото',                      // претензия, если пусто
//     check: (item, contest) => 'текст' | null,  // своя проверка
//     hint: 'подсказка под полем' }

import { esc } from '../util.js';
import { icon } from '../icons.js';
import { art, hasArt } from '../art.js';

// Общая проверка «отмечен ли правильный ответ» — нужна почти всем форматам.
export function needAnswer(item) {
  const marked = Number.isInteger(item.answer) || (item.answerText || '').trim();
  return marked ? null : 'не отмечен правильный ответ';
}

// Поле открытого ответа показывается, только пока нет вариантов.
export function noOptions(item) {
  return !(item.options || []).length;
}

// ——— общее ———

// Поля можно группировать в строку — { k: 'row', of: [...] }.
function flatten(list) {
  const out = [];
  for (const d of list || []) {
    if (!d) continue;
    if (d.k === 'row') out.push(...flatten(d.of));
    else out.push(d);
  }
  return out;
}

function shown(d, target, contest, state) {
  return typeof d.when === 'function' ? !!d.when(target, contest, state) : true;
}

function show(target, f) {
  const v = target ? target[f] : '';
  return v === null || v === undefined ? '' : v;
}

// data-fk — вид поля, data-f — имя поля, data-i — номер вопроса
// (у полей самого конкурса его нет).
function tag(d, f, i) {
  const name = f === undefined ? (d.f || '') : f;
  return `data-fk="${esc(d.k)}" data-f="${esc(name)}"` + (i === undefined ? '' : ` data-i="${i}"`);
}

function box(d, inner) {
  const style = d.width ? ` style="flex:0 0 ${esc(d.width)}"` : '';
  return `<div class="field"${style}>
      ${d.label ? `<label>${esc(d.label)}</label>` : ''}
      ${inner}
      ${d.hint ? `<div class="muted" style="margin-top:.25rem">${esc(d.hint)}</div>` : ''}
    </div>`;
}

function iconSlot(d, o, i, oi) {
  const inner = o.icon && hasArt(o.icon)
    ? art(o.icon)
    : (o.emoji ? `<span>${esc(o.emoji)}</span>` : '<span class="empty">нет</span>');
  return `<button class="icon-slot" data-act="pickIcon" ${tag(d, undefined, i)} data-o="${oi}"
            title="Выбрать картинку">${inner}</button>`;
}

// ——— как рисуется каждый вид поля ———

const RENDER = {
  row(d, target, i, api) {
    return `<div class="field-row">${d.of.map((x) => one(x, target, i, api)).join('')}</div>`;
  },

  text(d, target, i) {
    return box(d, `<input ${tag(d, undefined, i)} value="${esc(show(target, d.f))}"
      placeholder="${esc(d.placeholder || '')}">`);
  },

  textarea(d, target, i) {
    return box(d, `<textarea rows="${Number(d.rows) || 2}" ${tag(d, undefined, i)}>${esc(show(target, d.f))}</textarea>`);
  },

  number(d, target, i) {
    return box(d, `<input type="number" ${tag(d, undefined, i)} step="${esc(d.step || 'any')}"
      ${d.min === undefined ? '' : `min="${esc(d.min)}"`} ${d.max === undefined ? '' : `max="${esc(d.max)}"`}
      value="${esc(show(target, d.f))}" placeholder="${esc(d.placeholder || '')}">`);
  },

  choice(d, target, i) {
    const cur = target[d.f];
    return box(d, `<div style="display:flex;gap:.4rem">
      ${(d.values || []).map((v) => `<button class="a-btn ${cur === v.v ? 'a-btn--primary' : ''}"
        data-act="choice" ${tag(d, undefined, i)} data-v="${esc(v.v)}">${esc(v.label)}</button>`).join('')}
    </div>`);
  },

  options(d, target, i) {
    const opts = target[d.f] || [];
    const answerField = d.answerField || 'answer';
    return `
      <div class="muted" style="margin:.5rem 0 .3rem">${esc(d.label || 'Варианты ответа — отметь правильный')}</div>
      ${opts.map((o, oi) => `
        <div class="opt-row">
          <button class="opt-mark ${target[answerField] === oi ? 'is-on' : ''}" data-act="mark"
                  ${tag(d, undefined, i)} data-o="${oi}" title="Это правильный ответ">${icon('check')}</button>
          ${iconSlot(d, o, i, oi)}
          <input ${tag(d, undefined, i)} data-o="${oi}" value="${esc(o.text || '')}" placeholder="Текст варианта">
          <button class="a-btn a-btn--sm" data-act="delOpt" ${tag(d, undefined, i)} data-o="${oi}"
                  title="Убрать">${icon('cross')}</button>
        </div>`).join('')}
      <div style="display:flex;gap:.4rem;margin-top:.35rem;flex-wrap:wrap">
        <button class="a-btn a-btn--sm" data-act="addOpt" ${tag(d, undefined, i)}>${icon('plus')} вариант</button>
        ${d.guestFill ? `<button class="a-btn a-btn--sm" data-act="fillGuests" ${tag(d, undefined, i)}>Подставить гостей</button>` : ''}
        ${opts.length && d.allowClear !== false
    ? `<button class="a-btn a-btn--sm" data-act="clearOpts" ${tag(d, undefined, i)}>Сделать открытым вопросом</button>`
    : ''}
      </div>`;
  },

  media(d, target, i, api) {
    const cur = show(target, d.f);
    const files = (api.media || []).filter((f) => f.kind === d.kind);
    const list = '<option value="">— не выбрано —</option>' + files.map((f) =>
      `<option value="${esc(f.path)}" ${f.path === cur ? 'selected' : ''}>${esc(f.name)}</option>`).join('');

    let preview = '';
    if (d.kind === 'photo') {
      preview = cur ? `<img class="media-preview" src="${esc(cur)}" alt="">` : '';
    } else if (d.kind === 'audio') {
      preview = cur ? `<audio controls src="${esc(cur)}" style="width:100%;margin-top:.4rem"></audio>` : '';
    } else if (d.kind === 'video') {
      // id="vidPrev" — по нему кнопки «с плеера» узнают текущее время.
      preview = cur
        ? `<video class="vid-preview" id="vidPrev" src="${esc(cur)}" controls preload="metadata" style="margin-top:.4rem"></video>
           <div class="muted" style="margin-top:.3rem">Поставь видео на нужном моменте и жми «с плеера» у вопроса.</div>`
        : '<div class="muted" style="margin-top:.3rem">Загрузи видео ниже — потом выбери его здесь.</div>';
    }
    return box(d, `<select ${tag(d, undefined, i)}>${list}</select>${preview}`);
  },

  videoMarks(d, target, i) {
    const atF = d.atField || 'at';
    const endF = d.endField || 'revealEnd';
    const num = (f, label) => `<div class="field"><label>${esc(label)}</label>
        <input type="number" step="0.1" style="width:7rem" ${tag(d, f, i)} value="${Number(target[f]) || 0}"></div>`;
    const grab = (f) => `<button class="a-btn a-btn--sm" data-act="grab" ${tag(d, f, i)}>${icon('clock')} с плеера</button>`;
    return `<div class="marks-row">
      ${num(atF, d.atLabel || 'Пауза на секунде')}
      ${grab(atF)}
      ${num(endF, d.endLabel || 'Доиграть до')}
      ${grab(endF)}
      <button class="a-btn a-btn--sm" data-act="seek" ${tag(d, atF, i)}>${icon('play')} проверить</button>
    </div>`;
  },

  // Запасной выход для экзотики: формат рисует поле сам.
  custom(d, target, i, api) {
    return typeof d.render === 'function' ? (d.render(target, api) || '') : '';
  }
};

function one(d, target, i, api) {
  if (!shown(d, target, api.contest, api.state)) return '';
  const fn = RENDER[d.k];
  if (!fn) {
    console.error(`Неизвестный вид поля «${d.k}» — формат просит то, чего кабинет не умеет`);
    return `<div class="muted">Поле «${esc(d.k)}» кабинет рисовать не умеет</div>`;
  }
  return fn(d, target, i, api);
}

// ——— наружу ———

export function renderFields(list, target, i, api) {
  return (list || []).map((d) => one(d, target, i, api)).join('');
}

function find(list, fk, f) {
  for (const d of flatten(list)) {
    if (d.k !== fk) continue;
    // У меток на видео два поля на одно описание — оно одно на весь блок.
    if (d.k === 'videoMarks') return d;
    if ((d.f || '') === (f || '')) return d;
  }
  return null;
}

// Ввод в поле. Возвращает true, если что-то изменили.
export function applyInput(list, el, target) {
  const d = find(list, el.dataset.fk, el.dataset.f);
  if (!d) return false;
  const f = el.dataset.f;
  const o = el.dataset.o;

  if (d.k === 'options' && o !== undefined) {
    const opts = target[d.f] = target[d.f] || [];
    const opt = opts[Number(o)] || (opts[Number(o)] = { text: '', icon: '' });
    opt.text = el.value;
    return true;
  }
  if (d.k === 'videoMarks') { target[f] = Number(el.value) || 0; return true; }
  if (d.k === 'number') {
    target[f] = el.value === '' ? (d.emptyAs === 0 ? 0 : null) : Number(el.value);
    return true;
  }
  target[f] = el.value;
  return true;
}

// Нажатие на кнопку поля. Возвращает 'changed' (перерисовать и сохранить),
// 'handled' (поле разберётся само) или false — значит, кнопка не наша.
export function applyClick(list, btn, target, api) {
  const d = find(list, btn.dataset.fk, btn.dataset.f);
  if (!d) return false;
  const act = btn.dataset.act;
  const answerField = d.answerField || 'answer';

  if (act === 'mark') {
    const o = Number(btn.dataset.o);
    target[answerField] = target[answerField] === o ? null : o;
    return 'changed';
  }
  if (act === 'choice') {
    const v = Number(btn.dataset.v);
    target[d.f] = target[d.f] === v ? null : v;
    return 'changed';
  }
  if (act === 'addOpt') {
    (target[d.f] = target[d.f] || []).push({ text: '', icon: '' });
    return 'changed';
  }
  if (act === 'delOpt') {
    const o = Number(btn.dataset.o);
    (target[d.f] || []).splice(o, 1);
    if (target[answerField] === o) target[answerField] = null;
    else if (Number.isInteger(target[answerField]) && target[answerField] > o) target[answerField] -= 1;
    return 'changed';
  }
  if (act === 'clearOpts') {
    target[d.f] = [];
    target[answerField] = null;
    return 'changed';
  }
  if (act === 'fillGuests') {
    target[d.f] = ((api.state && api.state.guests) || []).map((g) => ({ text: g.name, icon: '' }));
    target[answerField] = null;
    return 'changed';
  }
  if (act === 'pickIcon') {
    const oi = Number(btn.dataset.o);
    api.openPicker('art', (value) => {
      const opt = (target[d.f] || [])[oi];
      if (!opt) return;
      opt.icon = value;
      delete opt.emoji;
      api.rerender();
      api.save();
    });
    return 'handled';
  }
  if (act === 'grab') {
    const at = api.videoTime();
    if (at === null) return 'handled';
    target[btn.dataset.f] = Math.round(at * 10) / 10;
    return 'changed';
  }
  if (act === 'seek') {
    api.videoSeek(Number(target[btn.dataset.f]) || 0);
    return 'handled';
  }
  return false;
}

// Чего не хватает — из этого и складывается «Готовность к празднику».
export function problems(list, target, contest, state) {
  const out = [];
  for (const d of flatten(list)) {
    if (!shown(d, target, contest, state)) continue;
    if (typeof d.check === 'function') {
      const why = d.check(target, contest, state);
      if (why) out.push(why);
      continue;
    }
    if (!d.required) continue;
    const v = target[d.f];
    const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
    if (empty) out.push(d.required);
  }
  return out;
}

// У медиаполя меняется превью, поэтому редактор надо перерисовать сразу.
export function needsRerender(list, el) {
  const d = find(list, el.dataset.fk, el.dataset.f);
  return !!d && d.k === 'media';
}
