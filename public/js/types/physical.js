import { counterHtml, esc, questionClass, noteHtml, mediaHtml, ownerAvatar } from '../util.js';
import { icon } from '../icons.js';
import { serverNow } from '../bus.js';
import { leftMs } from '../engine/timer.js';

// Физический номер: пройти по канату из подушек, изобразить слона, донести
// шарик на ложке. Экран показывает задание и таймер, судит ведущий.
//
// Это то, чего на детских праздниках всегда не хватает: конкурс, ради
// которого встают из-за стола.

const JUDGE = [
  { v: 'pass', label: 'Зачёт или незачёт' },
  { v: 'stars', label: 'Звёзды от 1 до 5' },
  { v: 'race', label: 'Дуэль: двое на скорость' },
  { v: 'pairs', label: 'Две пары от семей: кто больше' }
];

function playing(ctx) {
  const id = ctx.contestSlice.who;
  return ctx.owners.find((o) => o.id === id) || null;
}

// ——— дуэль на скорость ———
//
// Двое делают одно и то же наперегонки: собирают бумажный пазл из фото
// именинника, пеленают кукол. Пару выбирает колесо или ведущий, секундомер
// идёт на телевизоре, ведущий жмёт «Готово» за каждого — и видно, кто
// быстрее и на сколько. Всё хранится в кармане вопроса: время финиша каждого
// лежит отдельным ключом, чтобы два быстрых нажатия подряд не затёрли друг друга.

function isRace(item) {
  return !!item && item.judge === 'race';
}

function guestsOf(ctx) {
  return (ctx.state && ctx.state.guests) || [];
}

// Пара: выбранная вручную, иначе — та, на которой остановилось колесо этого задания.
function racers(ctx) {
  const s = ctx.slice || {};
  let ids = Array.isArray(s.racers) ? s.racers : [];
  const draw = ctx.runtime && ctx.runtime.partyDraw;
  if (!ids.length && draw && s.drawSeq && draw.seq === s.drawSeq) ids = (draw.picks || []).map((p) => p.id);
  return ids.map((id) => guestsOf(ctx).find((g) => g.id === id)).filter(Boolean).slice(0, 2);
}

function finishOf(ctx, guest) {
  const t = ctx.slice && ctx.slice['t_' + guest.id];
  return Number(t) > 0 ? Number(t) : 0;
}

function limitMs(ctx) {
  return (Number(ctx.item.seconds) || 0) * 1000;
}

// Кто быстрее из финишировавших.
function leader(ctx) {
  const done = racers(ctx).filter((g) => finishOf(ctx, g)).sort((a, b) => finishOf(ctx, a) - finishOf(ctx, b));
  return done[0] || null;
}

// Семья гостя — в семейном зачёте баллы идут ей.
function ownerOf(ctx, guest) {
  if (!guest) return null;
  return ctx.owners.find((o) => o.id === guest.id) || ctx.owners.find((o) => o.id === guest.teamId) || null;
}

// 83 400 мс → «1:23,4».
function stopwatch(ms) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const sec = Math.floor((t % 60000) / 1000);
  const tenth = Math.floor((t % 1000) / 100);
  return (m ? m + ':' + String(sec).padStart(2, '0') : String(sec)) + ',' + tenth;
}

// Что показывать в дорожке: ждём старта, идёт время, финиш или «время вышло».
function laneClock(ctx, guest, now = serverNow()) {
  const s = ctx.slice || {};
  const done = finishOf(ctx, guest);
  if (done) return { text: stopwatch(done), state: 'done' };
  if (!s.startedAt) return { text: '0,0', state: 'wait' };
  const run = now - s.startedAt;
  const limit = limitMs(ctx);
  if (limit && run >= limit) return { text: 'время вышло', state: 'late' };
  return { text: stopwatch(run), state: 'run' };
}

function raceHtml(ctx) {
  const pair = racers(ctx);
  const best = leader(ctx);
  const other = best && pair.find((g) => g.id !== best.id);
  const gap = best && other && finishOf(ctx, other) ? finishOf(ctx, other) - finishOf(ctx, best) : 0;
  const lanes = pair.length
    ? pair.map((g) => {
      const c = laneClock(ctx, g);
      const win = best && best.id === g.id;
      return `<div class="race-lane is-${c.state}${win ? ' is-win' : ''}">
          ${win ? `<span class="race-crown">${icon('crown-fill')}</span>` : ''}
          ${ownerAvatar(g, 'race-av')}
          <span class="race-name">${esc(g.name)}</span>
          <span class="race-clock" data-racer="${esc(g.id)}">${esc(c.text)}</span>
        </div>`;
    }).join('')
    : '<div class="hint">Кто выйдет на дуэль? Крутим колесо!</div>';
  const photo = ctx.item.photo ? `<div class="race-photo">${mediaHtml(ctx.item.photo, '')}</div>` : '';
  return `
    ${counterHtml(ctx)}
    <div class="eyebrow">Дуэль на скорость</div>
    <div class="${questionClass(ctx.item.q)}">${esc(ctx.item.q)}</div>
    <div class="race${photo ? ' race--photo' : ''}">
      ${photo}
      <div class="race-lanes">
        ${lanes}
        ${gap ? `<div class="race-gap fade-in">Быстрее на ${esc(stopwatch(gap))} с</div>` : ''}
      </div>
    </div>`;
}

// Секундомер тикает между обновлениями состояния — дорожки обновляем сами.
function tickLanes(root) {
  const ctx = root._raceCtx;
  if (!ctx || !isRace(ctx.item) || !root.querySelector('.race')) return false;
  for (const g of racers(ctx)) {
    const el = [...root.querySelectorAll('[data-racer]')].find((x) => x.dataset.racer === g.id);
    if (!el) continue;
    const c = laneClock(ctx, g);
    if (el.textContent !== c.text) el.textContent = c.text;
    const lane = el.closest('.race-lane');
    if (lane && !lane.classList.contains('is-' + c.state)) {
      lane.classList.remove('is-wait', 'is-run', 'is-done', 'is-late');
      lane.classList.add('is-' + c.state);
    }
  }
  return true;
}

// Пульт перерисовывается от каждого обновления состояния — без этой отметки
// список гостей захлопывался бы после первого же выбранного.
let manualOpen = false;

function raceRemote(ctx) {
  const pair = racers(ctx);
  const s = ctx.slice || {};
  const best = leader(ctx);
  const chosen = new Set(pair.map((g) => g.id));
  const finishBtn = (g) => (finishOf(ctx, g)
    ? `<button class="btn btn--ghost" data-act="unfinish" data-guest="${esc(g.id)}">${icon('check')} ${esc(g.name)}: ${esc(stopwatch(finishOf(ctx, g)))} с — отменить</button>`
    : `<button class="btn btn--teal" data-act="finish" data-guest="${esc(g.id)}">Готово: ${esc(g.name)}</button>`);
  return `
    <div class="r-question">${esc(ctx.item.q)}</div>
    <div class="r-note">Дуэль: ${pair.length ? pair.map((g) => `<b>${esc(g.name)}</b>`).join(' и ') : 'пара не выбрана'}${limitMs(ctx) ? ` · лимит ${Number(ctx.item.seconds)} с` : ''}</div>
    <div class="r-media-controls">
      <button class="btn btn--purple" data-act="pair">${icon('users')} Колесо: выбрать пару</button>
      <button class="btn btn--primary" data-act="go">${icon('play')} ${s.startedAt ? 'Старт заново' : 'Старт'}</button>
    </div>
    ${pair.length ? `<div class="r-media-controls">${pair.map(finishBtn).join('')}</div>` : ''}
    <div class="r-media-controls">
      <button class="btn btn--primary" data-act="win" ${best ? '' : 'disabled'}>${icon('crown')} Победителю +${ctx.points}${best ? ` (${esc(best.name)})` : ''}</button>
      <button class="btn btn--ghost" data-act="again">${icon('restart')} Переиграть</button>
    </div>
    <details class="r-note"${manualOpen ? ' open' : ''}>
      <summary data-act="manual">Выбрать пару вручную</summary>
      <div class="r-media-controls">
        ${guestsOf(ctx).map((g) => `<button class="btn ${chosen.has(g.id) ? 'btn--primary' : 'btn--ghost'}"
          data-act="racer" data-guest="${esc(g.id)}">${esc(g.name)}</button>`).join('')}
      </div>
    </details>
    ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
  `;
}

// ——— две пары от семей ———
//
// «Поймай как можно больше попкорна»: от двух семей выходит по паре —
// один бросает, другой ловит. Идёт таймер, ведущий считает пойманное
// кнопкой «+1», у кого больше — та семья и забирает баллы. Счёт прибавляет
// сервер (sliceAdd): частые нажатия подряд не теряются.

function isPairs(item) {
  return !!item && item.judge === 'pairs';
}

function teamsOf(ctx) {
  return (ctx.state && ctx.state.teams) || [];
}

// Кто из семьи может выйти: отмеченные «не играет» сидят за столом.
function playersOf(ctx, team) {
  return guestsOf(ctx).filter((g) => g.teamId === team.id && g.playing !== false);
}

function pairTeams(ctx) {
  const ids = (ctx.slice && ctx.slice.teams) || [];
  return ids.map((id) => teamsOf(ctx).find((t) => t.id === id)).filter(Boolean).slice(0, 2);
}

// Пара семьи: первый бросает, второй ловит.
function duoOf(ctx, team) {
  const ids = (ctx.slice && ctx.slice['m_' + team.id]) || [];
  return ids.map((id) => guestsOf(ctx).find((g) => g.id === id)).filter(Boolean).slice(0, 2);
}

function scoreOf(ctx, team) {
  return Number(ctx.slice && ctx.slice['c_' + team.id]) || 0;
}

// Таймер этого задания отзвенел.
function timeUp(ctx) {
  const t = ctx.runtime && ctx.runtime.timer;
  return !!t && t.contestId === ctx.contest.id && t.itemId === ctx.item.id && leftMs(t) <= 0;
}

// У кого больше. Ничья — победителя нет.
function pairsLeader(ctx) {
  const [a, b] = pairTeams(ctx);
  if (!a || !b || scoreOf(ctx, a) === scoreOf(ctx, b)) return null;
  return scoreOf(ctx, a) > scoreOf(ctx, b) ? a : b;
}

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pairsHtml(ctx) {
  const teams = pairTeams(ctx);
  const done = timeUp(ctx);
  const best = done ? pairsLeader(ctx) : null;
  const cards = teams.map((t) => {
    const [thrower, catcher] = duoOf(ctx, t);
    const win = best && best.id === t.id;
    return `<div class="duo${win ? ' is-win' : ''}${done && best && !win ? ' is-lost' : ''}">
        ${win ? `<span class="race-crown">${icon('crown-fill')}</span>` : ''}
        <div class="duo-head">${ownerAvatar(t, 'race-av')}<span class="duo-team">${esc(t.name)}</span></div>
        <div class="duo-roles">
          <span>бросает: <b>${thrower ? esc(thrower.name) : '—'}</b></span>
          <span>ловит: <b>${catcher ? esc(catcher.name) : '—'}</b></span>
        </div>
        <div class="duo-count">${scoreOf(ctx, t)}</div>
      </div>`;
  }).join('<div class="duo-vs">VS</div>');
  const tie = done && teams.length === 2 && !best;
  return `
    ${counterHtml(ctx)}
    <div class="eyebrow">Две пары — кто больше?</div>
    <div class="${questionClass(ctx.item.q)}">${esc(ctx.item.q)}</div>
    ${teams.length
    ? `<div class="duos">${cards}</div>${tie ? '<div class="race-gap fade-in">Ничья!</div>' : ''}`
    : '<div class="hint">Ведущий выбирает две пары от разных семей</div>'}`;
}

let pairsOpen = false;

function pairsRemote(ctx) {
  const teams = pairTeams(ctx);
  const best = pairsLeader(ctx);
  const chosen = new Set(teams.map((t) => t.id));
  const row = (t) => {
    const [thrower, catcher] = duoOf(ctx, t);
    return `<div class="r-note"><b>${esc(t.name)}</b>: бросает ${thrower ? esc(thrower.name) : '—'}, ловит ${catcher ? esc(catcher.name) : '—'}
        <button class="btn btn--ghost" data-act="pairsSwap" data-team="${esc(t.id)}">⇄</button></div>
      <div class="blitz-keys">
        <button class="btn btn--primary" data-act="pairsAdd" data-team="${esc(t.id)}" data-d="1">+1 · ${scoreOf(ctx, t)}</button>
        <button class="btn btn--ghost" data-act="pairsAdd" data-team="${esc(t.id)}" data-d="-1">−1</button>
      </div>`;
  };
  return `
    <div class="r-question">${esc(ctx.item.q)}</div>
    <div class="r-media-controls">
      <button class="btn btn--purple" data-act="pairsRandom">${icon('users')} Случайные пары</button>
      <button class="btn btn--primary" data-act="pairsGo">${icon('clock')} Старт ${Number(ctx.item.seconds) || 60} с</button>
    </div>
    ${teams.length ? teams.map(row).join('') : '<div class="r-note">Пары не выбраны: жми «Случайные пары» или выбери ниже.</div>'}
    <div class="r-media-controls">
      <button class="btn btn--primary" data-act="pairsWin" ${best ? '' : 'disabled'}>${icon('crown')} Победителю +${ctx.points}${best ? ` (${esc(best.name)})` : ''}</button>
      <button class="btn btn--ghost" data-act="pairsReset">${icon('restart')} Обнулить счёт</button>
    </div>
    <details class="r-note"${pairsOpen ? ' open' : ''}>
      <summary data-act="pairsManual">Выбрать пары вручную</summary>
      ${teamsOf(ctx).map((t) => {
    const duo = new Set(duoOf(ctx, t).map((g) => g.id));
    return `<div class="r-media-controls">
          <button class="btn ${chosen.has(t.id) ? 'btn--purple' : 'btn--ghost'}" data-act="pairsTeam" data-team="${esc(t.id)}">${esc(t.name)}</button>
          ${playersOf(ctx, t).map((g) => `<button class="btn ${duo.has(g.id) ? 'btn--primary' : 'btn--ghost'}"
            data-act="pairsMember" data-team="${esc(t.id)}" data-guest="${esc(g.id)}">${esc(g.name)}</button>`).join('')}
        </div>`;
  }).join('')}
      <div class="r-note">Первый выбранный бросает, второй ловит.</div>
    </details>
    ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
  `;
}

function sceneHtml(ctx) {
  if (isRace(ctx.item)) return raceHtml(ctx);
  if (isPairs(ctx.item)) return pairsHtml(ctx);
  const who = playing(ctx);
  return `
    ${counterHtml(ctx)}
    ${who ? `<div class="eyebrow">На арене: ${esc(who.name)}</div>` : ''}
    <div class="${questionClass(ctx.item.q)}">${esc(ctx.item.q)}</div>
    ${ctx.phase === 'reveal'
    ? `<div class="answer-note fade-in">Время! Справился? Ведущий ставит балл ${icon('star-fill')}</div>${noteHtml(ctx.item)}`
    : ctx.item.seconds ? `<div class="hint">На попытку — ${esc(ctx.item.seconds)} секунд</div>` : ''}
  `;
}

// Для проверки: кто в паре, кто быстрее и как пишется время.
export const _test = { racers, leader, stopwatch, laneClock, pairTeams, duoOf, pairsLeader, timeUp };

export default {
  id: 'physical',
  accent: '#2F9B4A',
  label: 'Номер на арене',
  icon: 'balance',
  order: 110,
  prop: { intro: 'mic', question: 'whistle', reveal: 'star' },
  itemNoun: 'задание',

  itemFields: [
    { k: 'textarea', f: 'q', label: 'Задание', rows: 2,
      placeholder: 'Например: «Пронеси шарик на ложке от дивана до окна»' },
    { k: 'row',
      of: [
        { k: 'number', f: 'seconds', label: 'Секунд на попытку', min: 5, max: 600,
          placeholder: '30' },
        { k: 'select', f: 'judge', label: 'Как судим', values: JUDGE }
      ] },
    { k: 'media', f: 'photo', kind: 'photo', label: 'Образец на экране (необязательно)',
      hint: 'Например, фото, из которого распечатан пазл. В дуэли пустое поле «Секунд» — без ограничения по времени.',
      when: (it) => isRace(it) },
    { k: 'text', f: 'answerNote', label: 'Приписка (необязательно)' }
  ],

  // Судит ведущий: машина не разберёт, донёс ли шарик.
  scoring: { rule: 'manual' },
  participation: {},
  // Число берётся из поля вопроса. Время запускает первое «Дальше» на задании
  // (или кнопка на пульте) — когда все готовы. У дуэли свой секундомер по
  // кнопке «Старт», у двух пар — «Старт» с обнулением счёта, «Дальше» их не трогает.
  timer: { seconds: 'seconds', autoStart: 'next', onEnd: 'stop', label: 'Время на попытку',
    when: (item) => !isRace(item) && !isPairs(item) },

  newContest() {
    return { title: 'Номер на арене', subtitle: 'Всех прошу на манеж' };
  },

  newItem() {
    return { id: '', q: 'Новое задание', seconds: 30, judge: 'pass', answerNote: '' };
  },

  // Рисуем через mount: в дуэли секундомер тикает без изменений состояния.
  // Обычное задание рисуется как раньше — тем же stage.
  mount(root, ctx) {
    root._raceCtx = ctx;
    const html = sceneHtml(ctx);
    if (root._physHtml !== html || !root.firstElementChild) {
      root._physHtml = html;
      root.innerHTML = html;
    }
    tickLanes(root);
    if (!isRace(ctx.item) || root._raceTick) return;
    root._raceTick = setInterval(() => {
      if (tickLanes(root)) return;
      clearInterval(root._raceTick);
      root._raceTick = 0;
    }, 100);
  },

  stage(ctx) {
    return sceneHtml(ctx);
  },

  lion(ctx) {
    if (isRace(ctx.item)) {
      return leader(ctx) ? 'Вот это скорость! Браво!' : 'На старт… внимание… марш!';
    }
    if (isPairs(ctx.item)) {
      return timeUp(ctx) ? 'Вот это улов! Считаем!' : 'Ловите, ловите! Ни зёрнышка мимо!';
    }
    return playing(ctx)
      ? 'Тише, тише! Артист сосредоточился.'
      : 'Кто смелый? Выходите на манеж!';
  },

  remote(ctx) {
    if (isRace(ctx.item)) return raceRemote(ctx);
    if (isPairs(ctx.item)) return pairsRemote(ctx);
    const who = playing(ctx);
    const stars = ctx.item.judge === 'stars';
    return `
      <div class="r-question">${esc(ctx.item.q)}</div>
      <div class="r-note">Кто выступает: ${who ? `<b>${esc(who.name)}</b>` : 'выбери ниже'}</div>
      <div class="r-media-controls">
        ${ctx.owners.map((o) => `
          <button class="btn ${who && who.id === o.id ? 'btn--primary' : 'btn--ghost'}"
                  data-act="who" data-owner="${esc(o.id)}">${esc(o.name)}</button>`).join('')}
      </div>

      <div class="r-note" style="margin-top:.6rem">Судейство</div>
      <div class="r-media-controls">
        ${stars
    ? [1, 2, 3, 4, 5].map((n) => `
            <button class="btn btn--ghost" data-act="stars" data-n="${n}">${icon('star')} ${n}</button>`).join('')
    : `<button class="btn btn--primary" data-act="pass">${icon('check')} Справился +${ctx.points}</button>
           <button class="btn btn--ghost" data-act="fail">${icon('cross')} В другой раз</button>`}
      </div>
      <div class="r-media-controls">
        <button class="btn btn--ghost" data-act="start">${icon('clock')} Запустить ${Number(ctx.item.seconds) || 30} с</button>
      </div>
      <div class="r-note">«Дальше» на задании тоже запускает время, следующее «Дальше» — к итогу.</div>
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
    `;
  },

  actions: {
    // ——— дуэль ———
    pair(ctx, api) {
      const guests = guestsOf(ctx).filter((g) => g.playing !== false);
      if (guests.length < 2) { api.toast('Нужно хотя бы двое гостей'); return; }
      const draw = ctx.runtime.partyDraw || {};
      const used = draw.used || [];
      // Почти все уже выходили — начинаем круг заново, а не отказываем.
      const fresh = guests.filter((g) => !used.includes(g.id)).length >= 2;
      api.send('partyDraw', { ids: guests.map((g) => g.id), count: 2, excludeUsed: fresh });
      api.send('setSlice', { patch: { drawSeq: (draw.seq || 0) + 1, racers: null, startedAt: 0 } });
    },
    racer(ctx, api, btn) {
      const id = btn.dataset.guest;
      let list = racers(ctx).map((g) => g.id);
      list = list.includes(id) ? list.filter((x) => x !== id) : list.concat(id).slice(-2);
      api.send('setSlice', { patch: { racers: list, startedAt: 0 } });
    },
    go(ctx, api) {
      const pair = racers(ctx);
      if (pair.length < 2) { api.toast('Сначала выбери двоих'); return; }
      const patch = { startedAt: serverNow(), racers: pair.map((g) => g.id) };
      for (const g of pair) patch['t_' + g.id] = 0;
      api.send('partyDraw', { close: true });
      api.send('setSlice', { patch });
      api.send('fx', { type: 'beep' });
      api.toast('Марш!');
    },
    finish(ctx, api, btn) {
      const s = ctx.slice || {};
      if (!s.startedAt) { api.toast('Сначала жми «Старт»'); return; }
      const first = !racers(ctx).some((g) => finishOf(ctx, g));
      api.send('setSlice', { patch: { ['t_' + btn.dataset.guest]: Math.max(1, serverNow() - s.startedAt) } });
      api.send('fx', { type: first ? 'tada' : 'gong' });
    },
    manual() { manualOpen = !manualOpen; },
    unfinish(ctx, api, btn) {
      api.send('setSlice', { patch: { ['t_' + btn.dataset.guest]: 0 } });
    },
    win(ctx, api) {
      const best = leader(ctx);
      const owner = ownerOf(ctx, best);
      if (!owner) { api.toast('Пока никто не закончил'); return; }
      api.send('award', { id: owner.id, delta: ctx.points, reason: ctx.contest.title });
      api.send('fx', { type: 'confetti' });
      api.toast(`${best.name}: +${ctx.points}`);
    },
    again(ctx, api) {
      const patch = { startedAt: 0 };
      for (const g of racers(ctx)) patch['t_' + g.id] = 0;
      api.send('setSlice', { patch });
    },

    // ——— две пары ———
    pairsRandom(ctx, api) {
      const ready = teamsOf(ctx).filter((t) => playersOf(ctx, t).length >= 2);
      if (ready.length < 2) { api.toast('Нужны две семьи, в каждой хотя бы двое играющих'); return; }
      const [a, b] = shuffle(ready);
      const patch = { teams: [a.id, b.id] };
      for (const t of [a, b]) {
        patch['m_' + t.id] = shuffle(playersOf(ctx, t)).slice(0, 2).map((g) => g.id);
        patch['c_' + t.id] = 0;
      }
      api.send('setSlice', { patch });
      api.send('fx', { type: 'drumroll' });
    },
    pairsManual() { pairsOpen = !pairsOpen; },
    pairsTeam(ctx, api, btn) {
      const id = btn.dataset.team;
      let list = pairTeams(ctx).map((t) => t.id);
      list = list.includes(id) ? list.filter((x) => x !== id) : list.concat(id).slice(-2);
      api.send('setSlice', { patch: { teams: list } });
    },
    pairsMember(ctx, api, btn) {
      const team = btn.dataset.team;
      const id = btn.dataset.guest;
      const s = ctx.slice || {};
      let duo = (s['m_' + team] || []).slice();
      duo = duo.includes(id) ? duo.filter((x) => x !== id) : duo.concat(id).slice(-2);
      let teams = pairTeams(ctx).map((t) => t.id);
      // Выбрали игрока — его семья выходит на арену сама.
      if (!teams.includes(team)) teams = teams.concat(team).slice(-2);
      api.send('setSlice', { patch: { ['m_' + team]: duo, teams } });
    },
    pairsSwap(ctx, api, btn) {
      const team = btn.dataset.team;
      const duo = ((ctx.slice || {})['m_' + team] || []).slice().reverse();
      api.send('setSlice', { patch: { ['m_' + team]: duo } });
    },
    pairsAdd(ctx, api, btn) {
      api.send('sliceAdd', { key: 'c_' + btn.dataset.team, delta: Number(btn.dataset.d) || 0 });
    },
    pairsGo(ctx, api) {
      const teams = pairTeams(ctx);
      if (teams.length < 2) { api.toast('Сначала выбери две пары'); return; }
      const patch = {};
      for (const t of teams) patch['c_' + t.id] = 0;
      api.send('partyDraw', { close: true });
      api.send('setSlice', { patch });
      api.send('timerStart', { seconds: Number(ctx.item.seconds) || 60, onEnd: 'stop', label: 'Ловим!' });
      api.toast('Поехали!');
    },
    pairsWin(ctx, api) {
      const best = pairsLeader(ctx);
      if (!best) { api.toast('Пока ничья'); return; }
      // В семейном зачёте баллы семье; если считаем каждого — обоим из пары.
      const team = ctx.owners.find((o) => o.id === best.id);
      const ids = team ? [team.id] : duoOf(ctx, best).map((g) => (ownerOf(ctx, g) || {}).id).filter(Boolean);
      for (const id of [...new Set(ids)]) api.send('award', { id, delta: ctx.points, reason: ctx.contest.title });
      api.send('fx', { type: 'confetti' });
      api.toast(`${best.name}: +${ctx.points}`);
    },
    pairsReset(ctx, api) {
      const patch = {};
      for (const t of pairTeams(ctx)) patch['c_' + t.id] = 0;
      api.send('setSlice', { patch });
    },

    who(ctx, api, btn) {
      api.send('setSlice', { scope: 'contest', patch: { who: btn.dataset.owner } });
    },
    start(ctx, api) {
      api.send('timerStart', {
        seconds: Number(ctx.item.seconds) || 30,
        label: 'Время на попытку'
      });
      api.toast('Время пошло!');
    },
    pass(ctx, api) {
      const who = playing(ctx);
      if (!who) { api.toast('Сначала выбери, кто выступает'); return; }
      api.send('award', { id: who.id, delta: ctx.points, reason: ctx.contest.title });
      api.send('fx', { type: 'confetti' });
    },
    fail(ctx, api) {
      api.send('fx', { type: 'wrong' });
      api.toast('Ничего, впереди ещё номера');
    },
    stars(ctx, api, btn) {
      const who = playing(ctx);
      if (!who) { api.toast('Сначала выбери, кто выступает'); return; }
      const n = Number(btn.dataset.n) || 0;
      api.send('award', { id: who.id, delta: n, reason: ctx.contest.title });
      if (n >= 4) api.send('fx', { type: 'confetti' });
    }
  }
};
