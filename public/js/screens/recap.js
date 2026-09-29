// «Как это было» — последний экран вечера, после диплома.
//
// Всё, что здесь показано, сервер копил по ходу праздника (runtime.stats):
// раунды живут недолго, а вспомнить хочется весь вечер целиком.

import { esc, owners, fmtScore } from '../util.js';
import { icon } from '../icons.js';
import { avatarHtml, sorted } from './parts.js';

// Кто чаще угадывал. Одного верного ответа мало, чтобы называться знатоком, —
// иначе победит тот, кто взял телефон на последнем вопросе.
const MIN_ANSWERS = 3;

function expert(stats) {
  const list = Object.values(stats.people || {}).filter((p) => p.total >= MIN_ANSWERS);
  if (!list.length) return null;
  return list.sort((a, b) =>
    (b.right / b.total) - (a.right / a.total) || b.right - a.right || b.total - a.total)[0];
}

// Вопрос, на котором сошлись почти все, и тот, где зал разошёлся сильнее всего.
function extremes(stats) {
  const asked = (stats.questions || []).filter((q) => q.scored && q.voices > 1);
  if (!asked.length) return {};
  const byShare = asked.slice().sort((a, b) => (b.correct / b.voices) - (a.correct / a.voices));
  return { easiest: byShare[0], hardest: byShare[byShare.length - 1] };
}

function card(label, value, sub) {
  return `<div class="recap-card">
    <div class="recap-label">${esc(label)}</div>
    <div class="recap-value">${value}</div>
    ${sub ? `<div class="recap-sub">${esc(sub)}</div>` : ''}
  </div>`;
}

export function recap(state) {
  const stats = (state.runtime && state.runtime.stats) || { people: {}, questions: [] };
  const list = sorted(owners(state));
  const winner = list.filter((o) => (o.score || 0) > 0)[0] || null;
  const questions = stats.questions || [];
  const contests = new Set(questions.map((q) => q.contest));
  const stars = list.reduce((sum, o) => sum + (Number(o.score) || 0), 0);
  const best = expert(stats);
  const { easiest, hardest } = extremes(stats);
  const letters = (state.show.capsule && state.show.capsule.letters) || [];
  const honors = state.show.honors || [];

  if (!questions.length) {
    return `
      <div class="eyebrow fade-in">Итоги</div>
      <h2 class="title-l gold-text fade-in">Как это было</h2>
      <div class="hint">Праздник ещё не сыгран — здесь появятся итоги вечера.</div>`;
  }

  return `
    <div class="eyebrow fade-in">Вот и всё</div>
    <h2 class="title-l gold-text fade-in">Как это было</h2>

    <div class="recap-grid fade-in">
      ${card('Номеров сыграно', String(contests.size))}
      ${card('Вопросов задано', String(questions.length))}
      ${card('Звёздочек роздано', `${fmtScore(stars)} ${icon('star-fill')}`)}
      ${letters.length ? card('Писем в будущее', String(letters.length)) : ''}
      ${honors.length ? card('Наград вручено', String(honors.length)) : ''}
    </div>

    <div class="recap-rows fade-in">
      ${winner ? `<div class="recap-row">
        ${avatarHtml(winner, 'recap-av')}
        <div>
          <div class="recap-label">Победитель вечера</div>
          <div class="recap-name">${esc(winner.name)} · ${fmtScore(winner.score)} ${icon('star-fill')}</div>
        </div>
      </div>` : ''}

      ${best ? `<div class="recap-row">
        <div class="recap-medal">${icon('star-fill')}</div>
        <div>
          <div class="recap-label">Главный знаток именинника</div>
          <div class="recap-name">${esc(best.name)} — ${best.right} из ${best.total}</div>
        </div>
      </div>` : ''}

      ${easiest ? `<div class="recap-row">
        <div class="recap-medal">${icon('users')}</div>
        <div>
          <div class="recap-label">Самый дружный ответ</div>
          <div class="recap-name">${esc(easiest.q)}</div>
          <div class="recap-sub">угадали ${easiest.correct} из ${easiest.voices}</div>
        </div>
      </div>` : ''}

      ${hardest && hardest !== easiest ? `<div class="recap-row">
        <div class="recap-medal">${icon('target')}</div>
        <div>
          <div class="recap-label">Самый коварный вопрос</div>
          <div class="recap-name">${esc(hardest.q)}</div>
          <div class="recap-sub">угадали ${hardest.correct} из ${hardest.voices}</div>
        </div>
      </div>` : ''}
    </div>

    <div class="hint fade-in">Спасибо, что были с нами!</div>
  `;
}
