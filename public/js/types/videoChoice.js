import { optionsHtml, counterHtml, noteHtml, esc, correctText } from '../util.js';
import { needAnswer } from '../engine/fields.js';
import { icon } from '../icons.js';

// Короткое имя именинника — из настроек праздника, а не из кода.
function heroOf(ctx) {
  return (ctx.names && ctx.names.short) || 'именинник';
}

// У вопроса может быть своё видео; нет — играем общее видео конкурса.
function videoOf(contest, item) {
  return (item && item.video) || (contest && contest.video) || '';
}

// До какой секунды доигрывать ролик. Своё видео у вопроса обычно уже обрезано
// ровно по выбору — его играем до конца (0 — «без остановки»). Общее видео
// конкурса длинное, в нём следом идут другие выборы: там без метки — 6 секунд.
function stopOf(contest, item) {
  const at = Number(item.at) || 0;
  const end = Number(item.revealEnd) || 0;
  if (end > at) return end;
  return item.video ? 0 : at + 6;
}

// Ролик сейчас доигрывается перед ответом? Сервер помнит, на каком вопросе.
function rollingOf(ctx) {
  const r = ctx.runtime || {};
  const roll = r.rolling;
  return roll && roll.contestId === r.contestId && roll.itemId === r.itemId ? roll : null;
}

function seekTo(video, t) {
  if (!video || !isFinite(t)) return;
  const go = () => { try { video.currentTime = t; } catch (e) { /* ещё не готово */ } };
  if (video.readyState >= 1) go();
  else video.addEventListener('loadedmetadata', go, { once: true });
}

export default {
  id: 'videoChoice',
  accent: '#15918D',
  label: 'Выбор на видео',
  icon: 'clapper',
  order: 30,
  prop: { intro: 'mic', question: '', reveal: 'star' },
  // «Дальше» на вопросе сначала доигрывает ролик, ответы в это время закрыты.
  // Ответ раскрывает сам телевизор, когда видео кончилось, — иначе подсветка
  // правильного варианта обгоняет ролик и интрига пропадает.
  revealAfterVideo: true,
  // Общее видео конкурса — на случай, когда все выборы сняты одним роликом.
  // Каждый вопрос может выбрать своё и это общее перебить.
  newContest() {
    return { video: '' };
  },

  fields: [
    { k: 'media', f: 'video', kind: 'video', label: 'Общее видео конкурса (необязательно)',
      hint: 'Играет в тех вопросах, где своё видео не выбрано.' }
  ],

  itemFields: [
    { k: 'textarea', f: 'q', label: 'Вопрос', rows: 2 },
    { k: 'options', f: 'options', check: needAnswer },
    { k: 'media', f: 'video', kind: 'video', label: 'Видео вопроса',
      check: (it, contest) => (videoOf(contest, it) ? null : 'не выбрано видео') },
    // Метки необязательны: ролик, обрезанный по выбору, стоит на первом
    // кадре и доигрывается до конца.
    { k: 'videoMarks', atField: 'at', endField: 'revealEnd',
      atLabel: 'Пауза на секунде (0 — первый кадр)', endLabel: 'Доиграть до (0 — до конца)' },
    { k: 'text', f: 'answerNote', label: 'Приписка к ответу (необязательно)' }
  ],

  scoring: { rule: 'exact', field: 'answer' },
  participation: { vote: { kind: 'choice', from: 'options' } },

  newItem(n) {
    return {
      id: '',
      q: `Что выберет ${(n && n.short) || 'именинник'}?`,
      options: [{ text: 'Вариант А', icon: '' }, { text: 'Вариант Б', icon: '' }],
      answer: null,
      answerNote: '',
      video: '',
      at: 0,
      revealEnd: 0
    };
  },

  mount(root, ctx) {
    const { contest, item, phase } = ctx;
    const hero = heroOf(ctx);
    const video = videoOf(contest, item);
    // Имя входит в ключ: переименовали именинника в кабинете — блок перерисуется.
    const key = contest.id + '/' + item.id + '/' + video + '/' + hero;
    const revealed = phase === 'reveal';

    if (root.dataset.vkey !== key) {
      root.dataset.vkey = key;
      // Те же три столбца, что и в викторине: слева ролик, посередине вопрос
      // с вариантами, справа табло. Ролики сняты на телефон и почти все
      // вертикальные — в полную ширину сцены они шли с чёрными полями по бокам.
      root.innerHTML = `
        ${counterHtml(ctx)}
        <div class="split">
          <div class="split-media">
            ${video
    ? `<div class="video-wrap"><video preload="auto" playsinline src="${esc(video)}"></video>
                   <div class="video-badge">${icon('clapper')} ${esc(hero)} на арене</div></div>`
    : '<div class="media-missing">Видео ещё не загружено — добавь его в кабинете</div>'}
          </div>
          <div class="split-side">
            <div class="question question--sm">${esc(item.q || `Что выберет ${hero}?`)}</div>
            <div class="js-options"></div>
            <div class="js-extra"></div>
          </div>
        </div>`;
      const v = root.querySelector('video');
      if (v) {
        v.muted = false;
        // Доиграли — сообщаем серверу, что пора раскрывать ответ.
        const finish = () => {
          const done = v._done;
          v._done = null;
          if (done) done();
        };
        v.addEventListener('timeupdate', () => {
          if (v._stopAt && v.currentTime >= v._stopAt) {
            v._stopAt = 0;
            v.pause();
            finish();
          }
        });
        v.addEventListener('ended', finish);
      }
    }

    const optionsBox = root.querySelector('.js-options');
    if (optionsBox) optionsBox.innerHTML = optionsHtml(item.options, item.answer, revealed);
    const extra = root.querySelector('.js-extra');
    if (extra) {
      extra.innerHTML = revealed
        ? (Number.isInteger(item.answer) ? '' : `<div class="answer-empty">Отметь в кабинете, что выбрал ${esc(hero)}</div>`) + noteHtml(item)
        : '';
    }

    const v = root.querySelector('video');
    if (!v) return;
    const at = Number(item.at) || 0;
    const roll = !revealed && rollingOf(ctx);
    const play = () => {
      seekTo(v, at);
      const p = v.play();
      if (p && p.catch) p.catch(() => { /* браузер ещё не разрешил звук */ });
    };

    if (roll) {
      // Смотрим выбор. Ответ ещё закрыт — его откроет конец ролика.
      if (v._phase !== 'roll' + key + roll.seq) {
        v._phase = 'roll' + key + roll.seq;
        v._stopAt = stopOf(contest, item);
        v._done = () => ctx.send('videoDone', { seq: roll.seq });
        play();
      }
    } else if (!revealed) {
      // Ждём на метке выбора: замерли и не двигаемся.
      v._stopAt = 0;
      v._done = null;
      if (v._phase !== 'q' + key) {
        v._phase = 'q' + key;
        v.pause();
        seekTo(v, at);
      }
    } else if (v._phase !== 'r' + key) {
      // Ролик только что доигрался (или ведущий раскрыл ответ, не дожидаясь
      // конца) — не перезапускаем его. Пришли к ответу иначе, например
      // «Назад» со следующего вопроса, — показываем выбор ещё раз.
      const rolled = String(v._phase || '').startsWith('roll' + key);
      v._phase = 'r' + key;
      v._done = null;
      if (!rolled) {
        v._stopAt = stopOf(contest, item);
        play();
      }
    }
  },

  lion(ctx) {
    return ctx.phase === 'reveal'
      ? 'Вот это выбор! Кто угадал — тому звёздочка.'
      : 'Тс-с-с! Не подсказывайте маэстро.';
  },

  remote(ctx) {
    const answer = correctText(ctx.item);
    const at = Number(ctx.item.at) || 0;
    const stop = stopOf(ctx.contest, ctx.item);
    const marks = (at > 0 ? `Пауза на ${at.toFixed(1)} сек` : 'Стоим на первом кадре')
      + (stop ? `, доигрываем до ${stop.toFixed(1)} сек` : ', доигрываем до конца');
    return `
      <div class="r-question">${esc(ctx.item.q || `Что выберет ${heroOf(ctx)}?`)}</div>
      <div class="r-answer ${answer ? '' : 'is-empty'}">
        <span class="r-answer-label">${esc(heroOf(ctx))} выбрал</span>
        <span class="r-answer-text">${answer ? esc(answer) : 'не заполнено'}</span>
      </div>
      <div class="r-note">${marks}</div>
      ${rollingOf(ctx) ? '<div class="r-note"><b>Видео идёт.</b> Ответ появится, когда ролик закончится. «Дальше» — показать сразу.</div>' : ''}
      ${videoOf(ctx.contest, ctx.item) ? '' : '<div class="r-note">У этого вопроса не выбрано видео — добавь его в кабинете.</div>'}
      ${ctx.item.answerNote ? `<div class="r-note">${esc(ctx.item.answerNote)}</div>` : ''}
      <div class="r-media-controls">
        <button class="btn btn--ghost" data-act="back">${icon('rewind')} −2 сек</button>
        <button class="btn btn--ghost" data-act="play">${icon('play')} Играть</button>
        <button class="btn btn--ghost" data-act="pause">${icon('pause')} Пауза</button>
        <button class="btn btn--ghost" data-act="fwd">${icon('forward')} +2 сек</button>
        <button class="btn btn--ghost" data-act="mark">${icon('restart')} На метку</button>
      </div>
    `;
  },

  // Управление плеером — дело этого формата, а не пульта.
  actions: {
    back(ctx, api) { api.send('video', { action: 'back' }); },
    play(ctx, api) { api.send('video', { action: 'play' }); },
    pause(ctx, api) { api.send('video', { action: 'pause' }); },
    fwd(ctx, api) { api.send('video', { action: 'fwd' }); },
    mark(ctx, api) { api.send('video', { action: 'mark', at: Number(ctx.item.at) || 0 }); }
  }
};
