import { esc, owners, isTeamMode, ownerAvatar } from './util.js';
import { qrSvg } from './lib/qr.js';
import { icon } from './icons.js';
import { avatar, hasAvatar } from './avatars.js';
import { getType } from './types/index.js';

const BAR_COLORS = ['var(--red)', 'var(--teal)', 'var(--purple)', 'var(--orange)', 'var(--blue)', 'var(--green)'];

export function avatarHtml(guest, cls) {
  const inner = hasAvatar(guest.avatar)
    ? avatar(guest.avatar)
    : `<span style="display:grid;place-items:center;width:100%;height:100%;font-size:1.6em">${esc(guest.emoji || '')}</span>`;
  return `<div class="avatar ${cls || ''}" style="--c:${esc(guest.color || 'var(--ink)')}">${inner}</div>`;
}

function avatarChip(guest) {
  const inner = hasAvatar(guest.avatar)
    ? avatar(guest.avatar)
    : `<span style="display:grid;place-items:center;width:100%;height:100%">${esc(guest.emoji || '')}</span>`;
  return `<span class="av">${inner}</span>`;
}

export function welcome(state, net) {
  const show = state.show || {};
  const url = net && net.url ? net.url : '';
  return `
    <div class="eyebrow fade-in">Дамы и господа, добро пожаловать</div>
    <h1 class="title-xl gold-text fade-in">Цирк Тимоши</h1>
    <div class="welcome-age">${esc(show.age === undefined ? 1 : show.age)}</div>
    <div class="title-m fade-in purple-text">${esc(show.hero || 'Тимофей')} празднует первый день рождения!</div>
    ${url ? `
      <div class="connect-card fade-in">
        ${qrSvg(url, { dark: '#3A2350', light: '#ffffff' })}
        <div>
          <div class="label">Пульт ведущего</div>
          <div class="url">${esc(url)}</div>
        </div>
      </div>` : ''}
    <div class="hint">Начинаем — «дальше» на пульте или пробел на клавиатуре</div>
  `;
}

export function guests(state) {
  const list = state.guests || [];
  if (!list.length) {
    return `
      <h2 class="title-l gold-text fade-in">Наша труппа</h2>
      <div class="hint">Гостей пока нет — добавь их в кабинете или с пульта</div>`;
  }

  // В командном режиме знакомимся семьями, иначе — каждым гостем отдельно.
  if (isTeamMode(state)) {
    const teams = state.teams || [];
    const rest = list.filter((g) => !teams.some((t) => t.id === g.teamId));
    return `
      <div class="eyebrow fade-in">Сегодня на арене</div>
      <h2 class="title-l gold-text fade-in">Наши семьи</h2>
      <div class="family-grid fade-in">
        ${teams.map((t) => {
    const members = list.filter((g) => g.teamId === t.id);
    return `<div class="family-card" style="--c:${esc(t.color || 'var(--ink)')}">
            ${avatarHtml(t)}
            <div class="fname">${esc(t.name)}</div>
            <div class="members">${members.length
      ? members.map((g) => esc(g.name)).join(', ')
      : 'пока никого'}</div>
          </div>`;
  }).join('')}
      </div>
      ${rest.length ? `<div class="hint">Пока без семьи: ${rest.map((g) => esc(g.name)).join(', ')}</div>` : ''}
    `;
  }

  return `
    <div class="eyebrow fade-in">Сегодня на арене</div>
    <h2 class="title-l gold-text fade-in">Наша труппа</h2>
    <div class="guest-grid fade-in">
      ${list.map((g) => `
        <div class="guest-card">
          ${avatarHtml(g)}
          <div class="name">${esc(g.name)}</div>
          <div class="score">${g.score || 0} ${icon('star-fill')}</div>
        </div>`).join('')}
    </div>
  `;
}

export function intro(contest) {
  const type = getType(contest.type);
  return `
    <div class="poster pop-in">
      ${icon(type.icon, 'poster-ic')}
      <div class="eyebrow">${esc(contest.subtitle || 'Следующий номер')}</div>
      <h2 class="title-l gold-text">${esc(contest.title)}</h2>
      ${contest.rules ? `<div class="rules">${esc(contest.rules)}</div>` : ''}
    </div>
    <div class="hint">Готовы? Поехали!</div>
  `;
}

function sorted(list) {
  return list.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
}

export function leaderboard(state) {
  const list = sorted(owners(state));
  const max = Math.max(1, ...list.map((g) => g.score || 0));
  return `
    <div class="eyebrow fade-in">Считаем звёздочки</div>
    <h2 class="title-l gold-text fade-in">Таблица лидеров</h2>
    <div class="board fade-in">
      ${list.map((g, i) => `
        <div class="board-row ${i === 0 && g.score ? 'is-first' : ''}">
          <div class="rank">${i + 1}</div>
          ${avatarHtml(g)}
          <div class="name">${esc(g.name)}</div>
          <div class="bar" style="--c:${BAR_COLORS[i % BAR_COLORS.length]}">
            <span style="width:${Math.round(((g.score || 0) / max) * 100)}%"></span>
          </div>
          <div class="pts">${g.score || 0}</div>
        </div>`).join('')}
    </div>
  `;
}

export function finale(state) {
  const list = sorted(owners(state)).filter((g) => (g.score || 0) > 0);
  const [first, second, third] = list;
  if (!first) {
    return `
      <h2 class="title-l gold-text fade-in">Спасибо за представление!</h2>
      <div class="hint">Баллов пока нет — но праздник всё равно удался</div>`;
  }
  const col = (g, place, cls) => (g ? `
    <div class="podium-col ${cls}">
      ${place === 1 ? icon('crown-fill', 'crown') : ''}
      ${avatarHtml(g)}
      <div class="name">${esc(g.name)}</div>
      <div class="pts">${g.score} ${icon('star-fill')}</div>
      <div class="podium-block">${place}</div>
    </div>` : '');
  return `
    <div class="eyebrow fade-in">Гран-при циркового вечера</div>
    <h2 class="title-l gold-text pop-in">${esc(first.name)}!</h2>
    <div class="podium">
      ${col(second, 2, 'podium-2')}
      ${col(first, 1, 'podium-1')}
      ${col(third, 3, 'podium-3')}
    </div>
    <div class="title-m purple-text fade-in">Победитель получает подарок ${icon('gift')}</div>
  `;
}

// Круглая печать цирка с мордочкой Лёвы — рисуется прямо здесь, чтобы красиво печаталась.
function sealSvg() {
  return `
  <svg class="d-seal" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <defs><path id="sealArc" d="M60 60 m-41 0 a41 41 0 0 1 82 0"/></defs>
    <circle cx="60" cy="60" r="55" fill="none" stroke="#E63946" stroke-width="3"/>
    <circle cx="60" cy="60" r="47" fill="none" stroke="#E63946" stroke-width="1.5"/>
    <text font-family="Kelly Slab, serif" font-size="10" fill="#E63946" letter-spacing="1.6">
      <textPath href="#sealArc" startOffset="50%" text-anchor="middle">ЦИРК ТИМОШИ</textPath>
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
  const list = sorted(owners(state)).filter((g) => (g.score || 0) > 0);
  const winner = list[0];
  const show = state.show || {};
  const d = new Date();
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const date = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} года`;
  return `
    <div class="diploma pop-in">
      <div class="d-top">Цирк Тимоши представляет</div>
      <div class="d-title">Диплом</div>
      <div class="d-sub">вручается ${isTeamMode(state) ? 'семье-победителю' : 'победителю'} циркового вечера</div>
      <div class="d-name">${esc(winner ? winner.name : '—')}</div>
      <div class="d-line">за ${winner ? winner.score : 0} звёздочек и настоящее цирковое мастерство</div>
      <div class="d-sub" style="margin-top:.3rem">Именинник: ${esc(show.hero || 'Тимофей')}, ${esc(show.age === undefined ? 1 : show.age)} год</div>
      <div class="d-foot">
        <div class="d-sign">Директор цирка<b>Львёнок Лёва</b></div>
        ${sealSvg()}
        <div class="d-date">${esc(date)}</div>
      </div>
    </div>
    <div class="hint">Нажми Ctrl+P, чтобы распечатать</div>
  `;
}
