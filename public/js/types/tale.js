import { esc } from '../util.js';
import { icon } from '../icons.js';
import { leftMs } from '../engine/timer.js';
import { play as sfx } from '../sfx.js';

// Сказка с сюрпризом. Колесо выбирает рассказчика, он рассказывает любую
// сказку, а на экране время от времени выскакивает смешное слово —
// «сосиска», «директор», «трактор», — и его надо тут же вплести в сюжет.
//
// Слова идут по таймеру номера: пауза таймера — пауза слов, и телевизор,
// пульт и перезагруженная страница показывают одно и то же. Порядок слов
// перемешан, но одинаков на всех экранах, а у каждого выступления свои слова.
//
// Формат рисует себя через mount: слова появляются со временем, без
// всякого изменения состояния, и сцену надо обновлять самой.

const WORDS = [
  'сосиска', 'директор', 'трактор', 'бегемот', 'пылесос', 'балерина', 'кастрюля',
  'динозавр', 'пельмень', 'светофор', 'бабушкин тапок', 'космонавт', 'огурец',
  'экскаватор', 'пингвин', 'валенок', 'полицейский', 'торт', 'самокат', 'крокодил',
  'пижама', 'милиционер', 'холодильник', 'кабачок', 'водолаз', 'утюг', 'барабан',
  'подгузник', 'жираф', 'ракета', 'шаурма', 'ёжик в тумане', 'бутерброд', 'пожарный',
  'сковородка', 'кенгуру', 'бигуди', 'комбайн', 'соска', 'трамвай'
];

const EVERY = 15;      // секунд между словами по умолчанию
const QUIET_END = 5;   // в последние секунды новых слов уже не подкидываем

function wordsOf(contest) {
  const own = (contest && contest.words) || [];
  return own.length ? own : WORDS;
}

function everyOf(contest) {
  return Math.max(3, Number(contest && contest.every) || EVERY);
}

function secondsOf(item) {
  return Math.max(10, Number(item && item.seconds) || 120);
}

// Перемешиваем по зерну: у всех экранов один и тот же порядок.
function shuffled(list, seedText) {
  let seed = 0;
  for (const ch of String(seedText)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Сколько слов положено по таймеру. Лишние — кнопкой «Подкинуть слово».
function planned(ctx) {
  return Math.max(1, Math.floor((secondsOf(ctx.item) - QUIET_END) / everyOf(ctx.contest)));
}

// Слова этого выступления. У каждого выступления свой отрезок перемешанного
// списка — чтобы второй рассказчик не получил те же самые слова.
function roundWords(ctx) {
  const all = shuffled(wordsOf(ctx.contest), ctx.contest.id);
  const size = planned(ctx) + 5;
  const from = Math.max(0, ctx.index) * size;
  return Array.from({ length: size }, (_, i) => all[(from + i) % all.length]);
}

// Где мы по таймеру этого выступления.
function clockOf(ctx) {
  const t = ctx.runtime && ctx.runtime.timer;
  if (!t || t.contestId !== ctx.contest.id || t.itemId !== ctx.item.id) return { started: false };
  const total = (Number(t.seconds) || 0) * 1000;
  const left = leftMs(t);
  return { started: true, elapsed: total - left, done: left <= 0 };
}

// Сколько слов уже на экране.
function shownCount(ctx) {
  const c = clockOf(ctx);
  const bump = Number(ctx.slice && ctx.slice.bump) || 0;
  if (!c.started) return bump;
  const byTime = Math.min(planned(ctx), Math.floor(c.elapsed / 1000 / everyOf(ctx.contest)));
  return Math.min(roundWords(ctx).length, byTime + bump);
}

// Рассказчик — тот, на ком остановилось колесо, запущенное из этого выступления.
function teller(ctx) {
  const draw = ctx.runtime && ctx.runtime.partyDraw;
  const seq = ctx.slice && ctx.slice.drawSeq;
  if (!draw || !seq || draw.seq !== seq || !(draw.picks || []).length) return null;
  const pick = draw.picks[0];
  return ((ctx.state && ctx.state.guests) || []).find((g) => g.id === pick.id) || { id: pick.id, name: pick.name };
}

// Кому начислять: в семейном зачёте — семье рассказчика.
function tellerOwner(ctx, guest) {
  if (!guest) return null;
  return ctx.owners.find((o) => o.id === guest.id) || ctx.owners.find((o) => o.id === guest.teamId) || null;
}

function sceneHtml(ctx) {
  const who = teller(ctx);
  const c = clockOf(ctx);
  const words = roundWords(ctx).slice(0, shownCount(ctx));
  const last = words[words.length - 1];
  const before = words.slice(0, -1);

  let body;
  if (c.done) {
    body = `<div class="tale-end pop-in">Время! Вот это сказка ${icon('star-fill')}</div>
      ${words.length ? `<div class="tale-used">${words.map((w) => `<span>${esc(w)}</span>`).join('')}</div>` : ''}`;
  } else if (!words.length) {
    body = `<div class="hint">${c.started
      ? 'Сказка началась! Первое слово — совсем скоро…'
      : 'Как только пойдёт время, на экране начнут появляться слова. Каждое надо вплести в сказку!'}</div>`;
  } else {
    body = `<div class="tale-word" data-n="${words.length}">${esc(last)}</div>
      ${before.length ? `<div class="tale-used">${before.map((w) => `<span>${esc(w)}</span>`).join('')}</div>` : ''}`;
  }

  return `
    <div class="q-counter">Сказка ${ctx.index + 1} из ${ctx.total}</div>
    <div class="eyebrow">${who ? `Рассказывает: ${esc(who.name)}` : 'Кто расскажет сказку? Крутим колесо!'}</div>
    <div class="question question--sm">${esc(ctx.item.q || 'Любая сказка — на выбор рассказчика')}</div>
    <div class="tale">${body}</div>`;
}

// Для проверки: какие слова достанутся выступлению и сколько уже видно.
export const _test = { roundWords, shownCount, planned };

export default {
  id: 'tale',
  accent: '#C2410C',
  label: 'Сказка с сюрпризом',
  icon: 'masks',
  order: 115,
  prop: { intro: 'mic', question: 'mic', reveal: 'star' },
  itemNoun: 'выступление',

  fields: [
    { k: 'lines', f: 'words', label: 'Смешные слова — по одному в строке', rows: 8,
      hint: 'Пусто — возьмём встроенный список: сосиска, директор, трактор и ещё сорок.' },
    { k: 'number', f: 'every', label: 'Новое слово каждые, секунд', min: 3, max: 120, placeholder: String(EVERY) }
  ],

  itemFields: [
    { k: 'text', f: 'q', label: 'Какую сказку рассказываем',
      placeholder: 'Пусто — любую, на выбор рассказчика' },
    { k: 'number', f: 'seconds', label: 'Секунд на сказку', min: 10, max: 600, placeholder: '120' }
  ],

  // Судит зал аплодисментами, баллы ставит ведущий.
  scoring: { rule: 'manual' },
  participation: {},
  // Первое «Дальше» запускает время, как и кнопка «Старт».
  timer: { seconds: 'seconds', autoStart: 'next', onEnd: 'stop', label: 'Сказка' },

  newContest() {
    return {
      title: 'Сказка с сюрпризом',
      subtitle: 'Жили-были…',
      rules: 'Колесо выбирает рассказчика. Рассказываешь любую сказку, а на экране появляются слова — каждое надо вплести в сюжет!',
      words: WORDS.slice(),
      every: EVERY
    };
  },

  newItem() {
    return { id: '', q: '', seconds: 120 };
  },

  mount(root, ctx) {
    root._taleCtx = ctx;
    const paint = () => {
      const now = root._taleCtx;
      const html = sceneHtml(now);
      if (root._taleHtml === html && root.querySelector('.tale')) return;
      const before = root._taleWords || 0;
      const count = shownCount(now);
      root._taleHtml = html;
      root.innerHTML = html;
      // Новое слово — щелчок, чтобы рассказчик оторвался от зала и глянул на экран.
      if (count > before && root._taleKey === now.contest.id + '/' + now.item.id) sfx('point');
      root._taleKey = now.contest.id + '/' + now.item.id;
      root._taleWords = count;
    };
    paint();
    if (root._taleTick) return;
    root._taleTick = setInterval(() => {
      // Ушли с номера — сцену рисует уже кто-то другой, тикать незачем.
      if (!root.querySelector('.tale')) {
        clearInterval(root._taleTick);
        root._taleTick = 0;
        root._taleHtml = '';
        return;
      }
      paint();
    }, 250);
  },

  lion(ctx) {
    return clockOf(ctx).done
      ? 'Браво! Такой сказки даже я не слышал.'
      : 'Жили-были… а дальше — смотрите на экран!';
  },

  remote(ctx) {
    const who = teller(ctx);
    const draw = ctx.runtime && ctx.runtime.partyDraw;
    const spinning = draw && draw.open && draw.seq === (ctx.slice && ctx.slice.drawSeq) && Date.now() < draw.endsAt;
    const words = roundWords(ctx);
    const shown = shownCount(ctx);
    return `
      <div class="r-question">${esc(ctx.item.q || 'Любая сказка — на выбор рассказчика')}</div>
      <div class="r-note">Рассказывает: ${who ? `<b>${esc(who.name)}</b>` : spinning ? 'колесо крутится…' : 'пока не выбран'}</div>
      <div class="r-media-controls">
        <button class="btn btn--purple" data-act="spin">${icon('users')} Крутить колесо</button>
        <button class="btn btn--primary" data-act="start">${icon('clock')} Старт ${secondsOf(ctx.item)} с</button>
        <button class="btn btn--ghost" data-act="bump">${icon('plus')} Подкинуть слово</button>
      </div>
      <div class="r-note">«Старт» закрывает колесо и запускает время. Новое слово — каждые ${everyOf(ctx.contest)} с.</div>
      <div class="r-note">Слова выступления: ${words.slice(0, planned(ctx)).map((w, i) => i < shown ? `<s>${esc(w)}</s>` : esc(w)).join(', ')}
        · запас: ${words.slice(planned(ctx)).map(esc).join(', ')}</div>
      <div class="r-media-controls">
        <button class="btn btn--primary" data-act="bravo">${icon('star')} Браво +${ctx.points}</button>
        <button class="btn btn--ghost" data-act="applause">${icon('applause')} Овации</button>
      </div>
    `;
  },

  actions: {
    spin(ctx, api) {
      const guests = ((ctx.state && ctx.state.guests) || []).filter((g) => g.playing !== false);
      if (!guests.length) { api.toast('Сначала добавь гостей в кабинете'); return; }
      const draw = ctx.runtime.partyDraw || {};
      const used = draw.used || [];
      // Все уже рассказывали — начинаем круг заново, а не отказываем.
      const fresh = guests.some((g) => !used.includes(g.id));
      api.send('partyDraw', { ids: guests.map((g) => g.id), count: 1, excludeUsed: fresh });
      api.send('setSlice', { patch: { drawSeq: (draw.seq || 0) + 1 } });
    },
    start(ctx, api) {
      api.send('partyDraw', { close: true });
      api.send('timerStart', { seconds: secondsOf(ctx.item), onEnd: 'stop', label: 'Сказка' });
      api.toast('Жили-были…');
    },
    bump(ctx, api) {
      api.send('setSlice', { patch: { bump: (Number(ctx.slice && ctx.slice.bump) || 0) + 1 } });
    },
    bravo(ctx, api) {
      const owner = tellerOwner(ctx, teller(ctx));
      if (!owner) { api.toast('Сначала выбери рассказчика колесом'); return; }
      api.send('award', { id: owner.id, delta: ctx.points, reason: ctx.contest.title });
      api.send('fx', { type: 'confetti' });
    },
    applause(ctx, api) {
      api.send('fx', { type: 'applause' });
    }
  }
};
