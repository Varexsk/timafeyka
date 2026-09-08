import { optionsHtml, counterHtml, noteHtml, esc, correctText } from '../util.js';
import { needAnswer } from '../engine/fields.js';
import { icon } from '../icons.js';

// Короткое имя именинника — из настроек праздника, а не из кода.
function heroOf(ctx) {
  return (ctx.names && ctx.names.short) || 'именинник';
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
  // Видео у конкурса одно на все вопросы — поэтому поле уровня конкурса.
  newContest() {
    return { video: '' };
  },

  fields: [
    { k: 'media', f: 'video', kind: 'video', label: 'Видео конкурса',
      required: 'не выбрано видео конкурса' }
  ],

  itemFields: [
    { k: 'textarea', f: 'q', label: 'Вопрос', rows: 2 },
    { k: 'options', f: 'options', check: needAnswer },
    { k: 'videoMarks', atField: 'at', endField: 'revealEnd',
      check: (it) => (Number(it.at) > 0 ? null : 'не проставлена метка паузы') },
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
      at: 0,
      revealEnd: 0
    };
  },

  mount(root, ctx) {
    const { contest, item, phase } = ctx;
    const hero = heroOf(ctx);
    // Имя входит в ключ: переименовали именинника в кабинете — блок перерисуется.
    const key = contest.id + '/' + item.id + '/' + (contest.video || '') + '/' + hero;
    const revealed = phase === 'reveal';

    if (root.dataset.vkey !== key) {
      root.dataset.vkey = key;
      root.innerHTML = `
        ${counterHtml(ctx)}
        <div class="question question--sm">${esc(item.q || `Что выберет ${hero}?`)}</div>
        ${contest.video
          ? `<div class="video-wrap"><video preload="auto" playsinline src="${esc(contest.video)}"></video>
               <div class="video-badge">${icon('clapper')} ${esc(hero)} на арене</div></div>`
          : '<div class="media-missing">Видео ещё не загружено — добавь его в кабинете</div>'}
        <div class="js-options"></div>
        <div class="js-extra"></div>`;
      const v = root.querySelector('video');
      if (v) {
        v.muted = false;
        v.addEventListener('timeupdate', () => {
          if (v._stopAt && v.currentTime >= v._stopAt) {
            v._stopAt = 0;
            v.pause();
          }
        });
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

    if (!revealed) {
      // Ждём на метке выбора: замерли и не двигаемся.
      v._stopAt = 0;
      if (v._phase !== 'q' + key) {
        v._phase = 'q' + key;
        v.pause();
        seekTo(v, at);
      }
    } else if (v._phase !== 'r' + key) {
      v._phase = 'r' + key;
      const end = Number(item.revealEnd) || 0;
      v._stopAt = end > at ? end : at + 6;
      seekTo(v, at);
      const p = v.play();
      if (p && p.catch) p.catch(() => { /* браузер ещё не разрешил звук */ });
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
    return `
      <div class="r-question">${esc(ctx.item.q || `Что выберет ${heroOf(ctx)}?`)}</div>
      <div class="r-answer ${answer ? '' : 'is-empty'}">
        <span class="r-answer-label">${esc(heroOf(ctx))} выбрал</span>
        <span class="r-answer-text">${answer ? esc(answer) : 'не заполнено'}</span>
      </div>
      <div class="r-note">Пауза на ${at.toFixed(1)} сек${ctx.item.revealEnd ? `, доигрываем до ${Number(ctx.item.revealEnd).toFixed(1)} сек` : ''}</div>
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
