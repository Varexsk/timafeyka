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
