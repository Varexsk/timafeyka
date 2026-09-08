import { esc, ownerAvatar } from '../util.js';
import { icon } from '../icons.js';
import { getContext } from '../sfx.js';

// Аплодисметр. Зал хлопает — столбик растёт, рекорд остаётся.
//
// ⚠️ Микрофон браузер даёт только в «доверенном» окружении. Экран телевизора
// открывается как http://localhost:1717/ — localhost таковым считается, и всё
// работает. Но если открыть тот же экран с другого ноутбука по адресу
// 192.168.x.x, микрофона не будет: там нужен HTTPS, которого у нас нет.
// В этом случае формат честно говорит об этом и переходит на ручной режим —
// ведущий держит палец на кнопке, пока зал хлопает.

let analyser = null;
let data = null;
let raf = 0;
let peak = 0;
let level = 0;
let denied = false;

function stopMic() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  analyser = null;
}

// Громкость 0..1. Берём среднеквадратичное по кадру — оно ближе к тому,
// что ухо считает «громко», чем отдельные всплески.
function loudness() {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 4);
}

function startMic(onFail) {
  if (analyser || denied) return;
  if (!window.isSecureContext || !navigator.mediaDevices) { denied = true; onFail(); return; }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      const ctx = getContext();
      if (!ctx) { denied = true; onFail(); return; }
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      data = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
    })
    .catch(() => { denied = true; onFail(); });
}

function scoresOf(ctx) {
  return (ctx.contestSlice && ctx.contestSlice.scores) || {};
}

export default {
  id: 'applause',
  accent: '#22C1BC',
  label: 'Аплодисметр',
  icon: 'applause',
  order: 150,
  prop: { intro: 'mic', question: '', reveal: 'star' },
  itemNoun: 'замер',

  itemFields: [
    { k: 'textarea', f: 'q', label: 'За что хлопаем', rows: 2,
      placeholder: 'Например: «Кому достанется приз зрительских симпатий?»' },
    { k: 'number', f: 'seconds', label: 'Секунд на замер', min: 2, max: 30, placeholder: '5' }
  ],

  // Кто победил, объявляет ведущий: столбик — это зрелище, а не судья.
  scoring: { rule: 'manual' },
  participation: {},

  newContest() {
    return { title: 'Аплодисметр', subtitle: 'Громче всех' };
  },

  newItem() {
    return { id: '', q: 'Кому хлопаем громче?', seconds: 5 };
  },

  mount(root, ctx) {
    const key = ctx.contest.id + '/' + ctx.item.id;
    if (root.dataset.appkey !== key) {
      root.dataset.appkey = key;
      peak = 0;
      root.innerHTML = `
        <div class="question question--sm">${esc(ctx.item.q || 'Кому хлопаем громче?')}</div>
        <div class="clap">
          <div class="clap-bar"><span class="js-level"></span><i class="js-peak"></i></div>
          <div class="clap-note js-note"></div>
        </div>
        <div class="js-scores"></div>`;
      stopMic();
    }

    const note = root.querySelector('.js-note');
    startMic(() => {
      if (note) {
        note.innerHTML = 'Микрофон доступен только на экране, открытом как '
          + '<b>localhost</b>. Замеряй на слух: ведущий поставит баллы сам.';
      }
    });

    // Один цикл на весь номер: он рисует столбик и запоминает пик.
    if (!raf) {
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const bar = root.querySelector('.js-level');
        const mark = root.querySelector('.js-peak');
        if (!bar) { stopMic(); return; }
        level = Math.max(loudness(), level * 0.9);
        peak = Math.max(peak, level);
        bar.style.height = (level * 100).toFixed(1) + '%';
        if (mark) mark.style.bottom = (peak * 100).toFixed(1) + '%';
      };
      tick();
    }

    // Ведущий нажал «Замер»: обнуляем пик, а через отведённые секунды
    // отправляем результат — считает его та страница, у которой есть микрофон.
    const measure = (ctx.contestSlice || {}).measure;
    if (measure && root.dataset.measureSeq !== String(measure.seq)) {
      root.dataset.measureSeq = String(measure.seq);
      peak = 0;
      level = 0;
      const seconds = Number(ctx.item.seconds) || 5;
      setTimeout(() => {
        const next = Object.assign({}, scoresOf(ctx));
        next[measure.ownerId] = Math.round(peak * 1000) / 1000;
        ctx.send('setSlice', { scope: 'contest', patch: { scores: next, measure: null } });
      }, seconds * 1000);
    }

    const scores = scoresOf(ctx);
    const box = root.querySelector('.js-scores');
    if (box) {
      const list = ctx.owners.filter((o) => scores[o.id] !== undefined);
      box.innerHTML = list.length
        ? `<div class="clap-scores">${list.map((o) => `
            <div class="clap-score" style="--c:${esc(o.color || 'var(--ink)')}">
              ${ownerAvatar(o, 'bet-av-sm')}
              <span class="nm">${esc(o.name)}</span>
              <span class="pt">${Math.round(scores[o.id] * 100)}</span>
            </div>`).join('')}</div>`
        : '';
    }
  },

  lion() {
    return 'Громче! Я вас не слышу!';
  },

  remote(ctx) {
    const scores = scoresOf(ctx);
    return `
      <div class="r-question">${esc(ctx.item.q || 'Кому хлопаем громче?')}</div>
      <div class="r-note">Выбери, за кого хлопают, — и жми «Замер». Столбик на экране покажет громкость.</div>
      <div class="r-media-controls">
        ${ctx.owners.map((o) => `
          <button class="btn btn--ghost" data-act="measure" data-owner="${esc(o.id)}">
            ${esc(o.name)}${scores[o.id] !== undefined ? ` · ${Math.round(scores[o.id] * 100)}` : ''}
          </button>`).join('')}
      </div>
      <div class="r-media-controls">
        <button class="btn btn--ghost" data-act="clear">${icon('refresh')} Сбросить замеры</button>
      </div>
    `;
  },

  actions: {
    measure(ctx, api, btn) {
      api.send('setSlice', {
        scope: 'contest',
        patch: { measure: { ownerId: btn.dataset.owner, seq: Date.now() } }
      });
      api.send('timerStart', {
        seconds: Number(ctx.item.seconds) || 5,
        label: 'Хлопаем!'
      });
      api.toast('Хлопаем!');
    },
    clear(ctx, api) {
      api.send('setSlice', { scope: 'contest', patch: { scores: {}, measure: null } });
      api.toast('Замеры сброшены');
    }
  }
};
