// Как участники отвечают на вопрос.
//
// Формат объявляет только вид ответа (participation), а оболочка решает, где
// его собрать. Пока праздник идёт «только с пульта», числа и варианты за семьи
// вводит ведущий; ответы ложатся в ту же структуру раунда, что потом придёт
// с телефонов гостей, — на экране формат не различает, откуда они взялись.

import { esc, ownerAvatar } from '../util.js';
import { icon } from '../icons.js';

export function voteKind(ctx) {
  const decl = (ctx.type && ctx.type.participation) || {};
  return (decl.vote && decl.vote.kind) || '';
}

// Блок ввода ответов на пульте ведущего.
export function voteInputs(ctx) {
  const decl = (ctx.type && ctx.type.participation) || {};
  const vote = decl.vote;
  if (!vote || !ctx.contest || !ctx.item) return '';
  if (vote.kind === 'number') return numberInputs(ctx, vote);
  return '';
}

// «Помощь зала» на телевизоре — только объявление: кто взял джокер. Сам расклад
// голосов видят телефоны этой семьи, иначе подсказка доставалась бы всем.
export function audienceCallHtml(ctx, ownerIds) {
  const who = (ownerIds || []).map((id) => ctx.owners.find((o) => o.id === id)).filter(Boolean);
  if (!who.length) return '';
  return `<div class="audience-poll">
    <div class="audience-title">Помощь зала</div>
    ${who.map((o) => `<div class="audience-call">${ownerAvatar(o, 'audience-av')}<b>${esc(o.name)}</b></div>`).join('')}
    <div class="audience-empty">${who.length > 1 ? 'смотрят' : 'смотрит'} на телефоне, как ответил зал</div>
  </div>`;
}

// Разброс внутри семьи. Ведущий должен понимать, откуда взялось число семьи:
// «Бабушки: Нина 3200, Валя 3300 → 3250». Без этого начисление выглядит
// случайным, а спор за столом не разрешить.
export function voteBreakdown(ctx) {
  if (!ctx.contest || !ctx.item || !ctx.breakdownOf) return '';
  const rows = ctx.owners.map((o) => {
    const people = ctx.breakdownOf(o.id);
    if (people.length < 2) return '';
    const same = people.every((p) => String(p.v) === String(people[0].v));
    return `<div class="vote-by">
      <span class="vote-by-owner">${esc(o.name)}</span>
      <span class="vote-by-list">${people.map((p) => `${esc(p.name)}: ${esc(label(ctx, p.v))}`).join(' · ')}</span>
      ${same ? '' : `<span class="vote-by-sum">→ ${esc(label(ctx, ctx.voteOf(o.id)))}</span>`}
    </div>`;
  }).join('');
  return rows
    ? `<div class="r-note">Ответили по-разному — семье засчитывается сведённый ответ:</div>${rows}`
    : '';
}

// Номер варианта ведущему ничего не говорит — показываем сам вариант.
function label(ctx, value) {
  if (value === null || value === undefined) return '—';
  if (voteKind(ctx) === 'guest') {
    const guest = ((ctx.state && ctx.state.guests) || []).find((g) => g.id === value);
    return guest ? guest.name : '—';
  }
  if (voteKind(ctx) !== 'choice') return String(value);
  const option = (ctx.item.options || [])[Number(value)];
  const text = typeof option === 'string' ? option : (option && option.text) || '';
  return text || String(value);
}

function numberInputs(ctx, vote) {
  const unit = String((vote.unitField && ctx.item[vote.unitField]) || '').trim();
  return `
    <div class="r-note">${esc(vote.label || 'Впиши ответы участников:')}</div>
    ${ctx.owners.map((o) => `
      <div class="bet-row">
        ${ownerAvatar(o, 'bet-av-sm')}
        <span class="nm">${esc(o.name)}</span>
        <input type="number" inputmode="numeric" class="bet-in" data-vote="${esc(o.id)}"
               value="${ctx.hasVote(o.id) ? esc(ctx.voteOf(o.id)) : ''}"
               placeholder="${esc(unit || 'число')}">
      </div>`).join('')}
    <div class="r-media-controls">
      <button class="btn btn--ghost" data-round="clear">${icon('refresh')} Стереть ответы</button>
      <button class="btn btn--ghost" data-round="reset">${icon('restart')} Переиграть вопрос</button>
    </div>`;
}
