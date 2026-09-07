import { art, hasArt } from './art.js';
import { icon } from './icons.js';
import { avatar, hasAvatar } from './avatars.js';

// Очки считаются либо семьям, либо каждому гостю — зависит от режима праздника.
export function owners(state) {
  if (!state) return [];
  const mode = (state.show && state.show.mode) || 'teams';
  return (mode === 'guests' ? state.guests : state.teams) || [];
}

export function isTeamMode(state) {
  return ((state.show && state.show.mode) || 'teams') === 'teams';
}

export function ownerAvatar(owner, cls) {
  const inner = hasAvatar(owner.avatar)
    ? avatar(owner.avatar)
    : `<span class="av-fallback">${esc(owner.emoji || '')}</span>`;
  return `<span class="owner-av ${cls || ''}" style="--c:${esc(owner.color || 'var(--ink)')}">${inner}</span>`;
}

export const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'];

export function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function gridClass(n) {
  if (n <= 1) return 'options options--one';
  if (n === 3) return 'options options--three';
  if (n >= 6) return 'options options--many';
  return 'options';
}

// Картинка варианта: свой рисунок по id, а если у старых данных остался эмодзи — покажем его.
export function optionArt(o) {
  if (!o || typeof o === 'string') return '';
  if (o.icon && hasArt(o.icon)) return art(o.icon);
  if (o.emoji) return `<span class="emoji">${esc(o.emoji)}</span>`;
  return '';
}

// Карточки вариантов ответа. При раскрытии правильный подсвечивается, остальные гаснут.
export function optionsHtml(options, answer, revealed) {
  const list = options || [];
  if (!list.length) return '';
  const has = Number.isInteger(answer);
  return `<div class="${gridClass(list.length)}">` + list.map((o, i) => {
    const text = typeof o === 'string' ? o : o.text;
    const correct = revealed && has && i === answer;
    let cls = 'option';
    if (revealed && has) cls += correct ? ' is-correct' : ' is-dim';
    return `<div class="${cls}">
      <span class="letter">${LETTERS[i] || i + 1}</span>
      ${optionArt(o)}
      <span class="label">${esc(text)}</span>
      ${correct ? `<span class="tick">${icon('check')}</span>` : ''}
    </div>`;
  }).join('') + '</div>';
}

export function mediaHtml(path, hint) {
  if (!path) {
    return `<div class="media-missing">${esc(hint || 'Файл ещё не добавлен — загрузи его в кабинете')}</div>`;
  }
  return `<div class="media-frame"><img src="${esc(path)}" alt=""></div>`;
}

export function answerHtml(item, options) {
  const has = Number.isInteger(item.answer) && options && options.length;
  if (has) return '';
  const text = (item.answerText || '').trim();
  if (!text) return '<div class="answer-empty">Правильный ответ пока не заполнен — впиши его в кабинете</div>';
  return `<div class="answer-card pop-in">${esc(text)}</div>`;
}

export function noteHtml(item) {
  const note = (item.answerNote || '').trim();
  return note ? `<div class="answer-note fade-in">${esc(note)}</div>` : '';
}

export function counterHtml(ctx) {
  return `<div class="q-counter">Вопрос ${ctx.index + 1} из ${ctx.total}</div>`;
}

export function questionClass(text) {
  return String(text || '').length > 58 ? 'question question--sm' : 'question';
}
