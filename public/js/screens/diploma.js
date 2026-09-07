// Диплом победителю. Печатается по Ctrl+P на лист A4 — всё остальное со страницы уходит.

import { esc, owners, isTeamMode, names } from '../util.js';
import { avatarHtml, sorted } from './parts.js';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// «1 год», «2 года», «5 лет» — чтобы диплом не выглядел машинным.
function years(n) {
  const num = Number(n) || 0;
  const tail = num % 100;
  if (tail >= 11 && tail <= 14) return 'лет';
  const last = num % 10;
  if (last === 1) return 'год';
  if (last >= 2 && last <= 4) return 'года';
  return 'лет';
}

// Круглая печать цирка с мордочкой львёнка — рисуется прямо здесь, чтобы красиво печаталась.
function sealSvg(title) {
  const caption = String(title || '').toUpperCase();
  // Длинное название по дуге не помещается — уменьшаем кегль, а не обрезаем текст.
  const size = caption.length > 12 ? Math.max(6, Math.round(126 / caption.length)) : 10;
  return `
  <svg class="d-seal" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <defs><path id="sealArc" d="M60 60 m-41 0 a41 41 0 0 1 82 0"/></defs>
    <circle cx="60" cy="60" r="55" fill="none" stroke="#E63946" stroke-width="3"/>
    <circle cx="60" cy="60" r="47" fill="none" stroke="#E63946" stroke-width="1.5"/>
    <text font-family="Kelly Slab, serif" font-size="${size}" fill="#E63946" letter-spacing="1.6">
      <textPath href="#sealArc" startOffset="50%" text-anchor="middle">${esc(caption)}</textPath>
    </text>
    <text x="60" y="104" text-anchor="middle" font-family="Kelly Slab, serif" font-size="9"
          fill="#E63946" letter-spacing="1.2">ГРАН-ПРИ</text>
    <g transform="translate(60 62) scale(0.30) translate(-100 -98)">
      <g fill="#E63946">
        ${Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return `<circle cx="${(100 + Math.cos(a) * 50).toFixed(1)}" cy="${(98 + Math.sin(a) * 50).toFixed(1)}" r="17"/>`;
  }).join('')}
      </g>
      <circle cx="100" cy="98" r="40" fill="#fff" stroke="#E63946" stroke-width="4"/>
      <circle cx="86" cy="92" r="5" fill="#E63946"/>
      <circle cx="114" cy="92" r="5" fill="#E63946"/>
      <path d="M92 110h16a4 4 0 0 1 3 6l-8 7a4 4 0 0 1-6 0l-8-7a4 4 0 0 1 3-6z" fill="#E63946"/>
      <path d="M100 124q-10 10-18 1M100 124q10 10 18 1" stroke="#E63946" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;
}

export function diploma(state) {
  const winner = sorted(owners(state)).filter((g) => (g.score || 0) > 0)[0];
  const n = names(state);
  const d = new Date();
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} года`;
  return `
    <div class="diploma pop-in">
      <div class="d-top">${esc(n.title)} представляет</div>
      <div class="d-title">Диплом</div>
      <div class="d-sub">вручается ${isTeamMode(state) ? 'семье-победителю' : 'победителю'} циркового вечера</div>
      <div class="d-name">${esc(winner ? winner.name : '—')}</div>
      <div class="d-line">за ${winner ? winner.score : 0} звёздочек и настоящее цирковое мастерство</div>
      <div class="d-sub" style="margin-top:.3rem">Именинник: ${esc(n.hero)}, ${esc(n.age)} ${years(n.age)}</div>
      <div class="d-foot">
        <div class="d-sign">Директор цирка<b>Львёнок ${esc(n.lion)}</b></div>
        ${sealSvg(n.title)}
        <div class="d-date">${esc(date)}</div>
      </div>
    </div>
    <div class="hint">Нажми Ctrl+P, чтобы распечатать</div>
  `;
}
