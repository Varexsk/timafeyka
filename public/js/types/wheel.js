import { counterHtml, noteHtml, esc } from '../util.js';
import { icon } from '../icons.js';

// Колесо фортуны. Крутится на телевизоре, останавливается на секторе.
//
// Кто выпал, решает сервер (команда roll): иначе телевизор и телефоны
// покрутят каждый по-своему и покажут разное.
//
// Формат рисует себя через mount, а не stage: колесо должно доехать
// плавно, а перерисованный с нуля элемент начинал бы сразу с конца.

const PARTY = ['#E63946', '#FFC93C', '#22C1BC', '#FF7BAC', '#4CC96A', '#9B6BFF', '#4A90D9', '#FF8A3D'];

function sectorsOf(ctx) {
  const own = (ctx.item && ctx.item.sectors) || [];
  if (own.length) return own;
  // Сектора не заполнили — крутим по участникам: тоже полезно.
  return ctx.owners.map((o) => o.name);
}

function picked(ctx) {
  const roll = ctx.slice && ctx.slice.wheel;
  const list = sectorsOf(ctx);
  if (!roll || !list.length) return null;
  const index = roll.value % list.length;
  return { index, seq: roll.seq, text: list[index] };
}

// Колесо целиком в SVG: сектора, подписи и стрелка сверху.
function wheelSvg(list) {
  const n = list.length;
  const step = 360 / n;

  const arc = (i) => {
    const a0 = (i * step - 90) * Math.PI / 180;
    const a1 = ((i + 1) * step - 90) * Math.PI / 180;
    const x0 = 50 + 48 * Math.cos(a0);
    const y0 = 50 + 48 * Math.sin(a0);
    const x1 = 50 + 48 * Math.cos(a1);
    const y1 = 50 + 48 * Math.sin(a1);
    const big = step > 180 ? 1 : 0;
    return `M50 50 L${x0.toFixed(2)} ${y0.toFixed(2)} A48 48 0 ${big} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  };

  const label = (i) => {
    const a = ((i + 0.5) * step - 90) * Math.PI / 180;
    const x = 50 + 30 * Math.cos(a);
    const y = 50 + 30 * Math.sin(a);
    const turn = (i + 0.5) * step;
    // В нижней половине подпись встала бы вверх ногами — разворачиваем её.
    const flip = turn > 90 && turn < 270 ? 180 : 0;
    const text = String(list[i]);
    const short = text.length > 14 ? text.slice(0, 13) + '…' : text;
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle"
      transform="rotate(${(turn + flip).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})"
      font-size="${n > 8 ? 3.6 : 4.8}" font-weight="900" fill="#3A2350">${esc(short)}</text>`;
  };

  return `
    <div class="wheel-wrap">
      <svg class="wheel" viewBox="0 0 100 100">
        <g class="wheel-spin">
          ${list.map((_, i) => `<path d="${arc(i)}" fill="${PARTY[i % PARTY.length]}" stroke="#3A2350" stroke-width="0.6"/>`).join('')}
          ${list.map((_, i) => label(i)).join('')}
          <circle cx="50" cy="50" r="7" fill="#FFF6E5" stroke="#3A2350" stroke-width="1.2"/>
        </g>
      </svg>
      <div class="wheel-pin"></div>
    </div>`;
}

export default {
  id: 'wheel',
  accent: '#9B6BFF',
  label: 'Колесо фортуны',
  icon: 'sparkle',
  order: 90,
  prop: { intro: 'mic', question: 'ticket', reveal: 'star' },
  itemNoun: 'кон',

  itemFields: [
    { k: 'textarea', f: 'q', label: 'Что решает колесо', rows: 2,
      placeholder: 'Например: «Кого вызываем на арену?»' },
    { k: 'lines', f: 'sectors', label: 'Сектора — по одному в строке', rows: 7,
      placeholder: 'Изобрази слона\nСпой колыбельную\nПройди по канату',
      check: (it) => ((it.sectors || []).length >= 2 ? null : 'нужно хотя бы два сектора') },
    { k: 'text', f: 'answerNote', label: 'Приписка (необязательно)' }
  ],

  // Колесо только выбирает — балл за выполненное ставит ведущий.
  scoring: { rule: 'manual' },
  participation: {},

  newContest() {
    return { title: 'Колесо фортуны', subtitle: 'Испытание судьбы' };
  },

  newItem() {
    return { id: '', q: 'Кого вызываем на арену?', sectors: [], answerNote: '' };
  },

  mount(root, ctx) {
    const list = sectorsOf(ctx);
    const key = [ctx.contest.id, ctx.item.id, list.join('|')].join('/');

    if (root.dataset.wkey !== key) {
      root.dataset.wkey = key;
      root.innerHTML = list.length
        ? `${counterHtml(ctx)}
           <div class="question question--sm">${esc(ctx.item.q || 'Что решает колесо?')}</div>
           ${wheelSvg(list)}
           <div class="js-result"></div>`
        : `${counterHtml(ctx)}
           <div class="answer-empty">Впиши сектора в кабинете — или заведи семьи, и колесо покрутит по ним</div>`;
    }
    if (!list.length) return;

    const hit = picked(ctx);
    const spin = root.querySelector('.wheel-spin');
    if (spin) {
      // Каждый бросок докручивает ещё четыре оборота: видно, что крутанули
      // заново, даже если выпало то же самое.
      const step = 360 / list.length;
      const angle = hit ? 360 * 4 * hit.seq - (hit.index * step + step / 2) : 0;
      spin.style.setProperty('--turn', angle.toFixed(2) + 'deg');
    }

    const result = root.querySelector('.js-result');
    if (result) {
      result.innerHTML = hit
        ? `<div class="answer-card pop-in">${esc(hit.text)}</div>${noteHtml(ctx.item)}`
        : '<div class="hint">Ведущий крутит колесо с пульта</div>';
    }
  },

  lion(ctx) {
    return picked(ctx)
      ? 'Судьба сказала своё слово!'
      : 'Крутите, маэстро! Колесо не обманет.';
  },

  remote(ctx) {
    const list = sectorsOf(ctx);
    const hit = picked(ctx);
    return `
      <div class="r-question">${esc(ctx.item.q || 'Что решает колесо?')}</div>
      <div class="r-answer ${hit ? '' : 'is-empty'}">
        <span class="r-answer-label">Выпало</span>
        <span class="r-answer-text">${hit ? esc(hit.text) : 'ещё не крутили'}</span>
      </div>
      <div class="r-note">Секторов: ${list.length}</div>
      <div class="r-media-controls">
        <button class="btn btn--primary" data-act="spin">${icon('refresh')} ${hit ? 'Ещё раз' : 'Крутить!'}</button>
      </div>
    `;
  },

  actions: {
    spin(ctx, api) {
      api.send('roll', { key: 'wheel', max: sectorsOf(ctx).length });
      api.send('fx', { type: 'drumroll' });
      api.toast('Крутим!');
    }
  }
};
