import { send } from './bus.js';
import { esc } from './util.js';
let root, state, planKey = '', peopleKey = '', settingsKey = '', mediaFiles = [];
const $ = s => root.querySelector(s);
const nominations = ['Звезда цирка Тимоши', 'Самая артистичная бабушка', 'Главный знаток Тимоши', 'Мастер смешных ответов', 'Самый весёлый артист', 'За самые тёплые объятия'];
async function command(type, payload) {
  const r = await send(type, payload);
  $('[data-director-status]').textContent = r.ok ? 'Готово' : r.error || 'Нет связи. Попробуй ещё раз.';
  return r.ok;
}
function options(list) { return list.map(f => `<option value="${esc(f.path)}">${esc(f.name)}</option>`).join(''); }
export function mountDirectorRemote() {
  root = document.createElement('section'); root.className = 'card director-console';
  root.innerHTML = `<h3>Праздник одной кнопкой</h3><button class="btn btn--purple btn--wide" data-director="break">Антракт</button>
    <div class="party-row"><button class="btn btn--primary" data-director="entrance">Выход участника</button><button class="btn btn--primary" data-director="pair">Выход пары</button></div>
    <p class="r-note">Отмеченные во вкладке «Участники» гости → колесо → дробь → фанфары. Уже выбранные исключаются.</p>
    <details><summary>Вручить подарок или номинацию</summary>
      <label>Кому<select data-honor-guest></select></label>
      <label>Номинация<input data-honor-title list="honor-presets" value="Звезда цирка Тимоши"><datalist id="honor-presets">${nominations.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <button class="btn btn--yellow btn--wide" data-director="gift">Вручить с фанфарами</button><p data-honors class="r-note"></p>
    </details>
    <button class="btn btn--ghost btn--wide" data-director="close">Закрыть сценку</button>
    <details><summary>План вечера и запасные конкурсы</summary><p data-plan-summary></p><div data-plan></div></details>
    <details><summary>Семейный альбом</summary>
      <div class="party-row"><button class="btn" data-director="export">Открыть альбом</button><button class="btn" data-director="album-stage">QR альбома на ТВ</button></div>
      <p class="r-note">В альбоме фотографии из фотобудки, номинации и итоги вечера. Гости открывают его по QR-коду со своих телефонов.</p>
    </details>
    <label>Движение на сцене<select data-setting="motion"><option value="full">Полное шоу — свет, занавес и ходьба Лёвы</option><option value="calm">Спокойный режим</option></select></label>
    <details><summary>Что сделает Лёва</summary><div class="party-row">${[['enter','Выйти'],['bow','Поклониться'],['clap','Похлопать'],['surprise','Удивиться'],['gift','Вручить билет']].map(([k,l]) => `<button class="btn" data-motion="${k}">${l}</button>`).join('')}</div></details>
    <details><summary>Музыка сценок и фотографии антракта</summary>
      <label>Музыка антракта<select data-setting="breakTrack"></select></label>
      <label>Музыка вручения<select data-setting="giftTrack"></select></label>
      <label>Музыка номеров<select data-setting="themeMusic"><option value="auto">Включается сама с афишей номера</option><option value="off">Только вручную с DJ-пульта</option></select></label>
      <label>Фото на антракте<select data-setting="breakAlbum"></select></label>
      <button class="btn" data-director="media">Обновить список медиа</button>
      <p class="r-note">Если трек не выбран, антракт будет тихим, а вручение прозвучит с фанфарами.</p>
    </details><p data-director-status role="status" class="r-note"></p>`;
  document.querySelector('.party-console').before(root);
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.setting) command('directorSettings', { [t.dataset.setting]: t.value });
    const row = t.closest('[data-plan-id]');
    if (row && t.dataset.planField) command('planUpdate', { id: row.dataset.planId, [t.dataset.planField]: t.type === 'checkbox' ? t.checked : t.value });
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || !state) return;
    if (b.dataset.motion) return command('lionAct', { kind: b.dataset.motion });
    const row = b.closest('[data-plan-id]');
    if (row) {
      if (b.dataset.move) command('planUpdate', { id: row.dataset.planId, direction: Number(b.dataset.move) });
      if (b.dataset.launch) command('planLaunch', { id: row.dataset.planId });
      return;
    }
    const act = b.dataset.director;
    if (act === 'break') command('intermission', { on: !state.runtime.intermission?.open });
    if (act === 'close') command('directorCue', { kind: 'close' });
    if (act === 'gift') command('directorCue', { kind: 'gift', guestId: $('[data-honor-guest]').value, title: $('[data-honor-title]').value });
    if (act === 'entrance' || act === 'pair') {
      const ids = [...document.querySelectorAll('[data-guest]:checked')].map(c => c.value);
      const available = ids.filter(id => !(state.runtime.partyDraw?.used || []).includes(id));
      if (available.length < (act === 'pair' ? 2 : 1)) { $('[data-director-status]').textContent = 'Недостаточно гостей. Отметь участников или сбрось историю колеса.'; return; }
      command('directorCue', { kind: 'entrance', ids, count: act === 'pair' ? 2 : 1 });
    }
    if (act === 'export') window.open('/album', '_blank');
    if (act === 'album-stage') command('albumStage', { open: !state.runtime.albumStage?.open });
    if (act === 'media') refreshMedia();
  });
  refreshMedia();
}
async function refreshMedia() {
  try { const r = await fetch('/api/media'); mediaFiles = (await r.json()).files.filter(f => f.kind === 'audio'); settingsKey = ''; if (state) updateDirectorRemote(state); }
  catch { $('[data-director-status]').textContent = 'Не удалось загрузить музыку'; }
}
export function updateDirectorRemote(next) {
  state = next; if (!root) return;
  const r = state.runtime, s = state.show;
  $('[data-director="break"]').textContent = r.intermission?.open ? 'Продолжить праздник' : 'Антракт';
  root.classList.toggle('is-intermission', !!r.intermission?.open);
  for (const id of ['btnNext','btnPrev','btnReveal']) {
    const b = document.getElementById(id); if (r.intermission?.open) b.disabled = true;
    else if (id !== 'btnReveal') b.disabled = false;
  }
  document.querySelectorAll('#timerBar button').forEach(b=>b.disabled = !!r.intermission?.open);
  const people = JSON.stringify(state.guests.map(g => [g.id,g.name]));
  if (people !== peopleKey) { peopleKey = people; const old = $('[data-honor-guest]').value; $('[data-honor-guest]').innerHTML = state.guests.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join(''); if (state.guests.some(g => g.id === old)) $('[data-honor-guest]').value = old; }
  const enabled = s.contests.filter(c => c.enabled !== false);
  const at = enabled.findIndex(c => c.id === r.contestId);
  const current = r.screen === 'show' && at >= 0 ? enabled[at] : null;
  const upcoming = current ? enabled[at + 1] : enabled[0];
  const total = enabled.reduce((n,c) => n + (Number(c.durationMinutes) || 5), 0);
  $('[data-plan-summary]').textContent = `Программа: ≈ ${total} мин. Сейчас: ${current?.title || 'вне конкурса'}. Далее: ${upcoming?.title || 'финал'}.`;
  const key = JSON.stringify(s.contests.map(c => [c.id,c.title,c.enabled,c.durationMinutes,c.propsNeeded])) + r.contestId + r.screen;
  if (key !== planKey) {
    planKey = key;
    $('[data-plan]').innerHTML = s.contests.map(c => `<article class="director-plan-row" data-plan-id="${esc(c.id)}"><strong>${esc(c.title)}</strong>${c.id === current?.id ? '<span class="director-pill">Сейчас</span>' : ''}
      <label>Примерно минут<input type="number" min="1" max="120" data-plan-field="minutes" value="${Number(c.durationMinutes) || 5}"></label>
      <label>Реквизит<input data-plan-field="props" value="${esc(c.propsNeeded || '')}" placeholder="Мячи, карточки, подарки…"></label>
      <label><input type="checkbox" data-plan-field="reserve" ${c.enabled === false ? 'checked' : ''} ${c.id === current?.id ? 'disabled' : ''}> Запасной конкурс</label>
      <div class="party-row"><button class="btn" data-move="-1" aria-label="Поднять ${esc(c.title)}">↑</button><button class="btn" data-move="1" aria-label="Опустить ${esc(c.title)}">↓</button><button class="btn btn--teal" data-launch="1">${c.enabled === false ? 'Включить и начать' : 'Начать'}</button></div></article>`).join('');
  }
  const sk = JSON.stringify([s.director,s.contests.filter(c=>c.type==='slideshow').map(c=>[c.id,c.title]),mediaFiles]);
  if (settingsKey !== sk) {
    settingsKey = sk;
    $('[data-setting="motion"]').value = s.director?.motion || 'full';
    $('[data-setting="themeMusic"]').value = s.director?.themeMusic || 'auto';
    for (const field of ['breakTrack','giftTrack']) { const el = $(`[data-setting="${field}"]`); el.innerHTML = '<option value="">Без трека</option>' + options(mediaFiles); el.value = s.director?.[field] || ''; }
    $('[data-setting="breakAlbum"]').innerHTML = '<option value="">Заставка «Антракт»</option>' + s.contests.filter(c=>c.type==='slideshow').map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join(''); $('[data-setting="breakAlbum"]').value = s.director?.breakAlbum || '';
  }
  $('[data-honors]').textContent = `Наград вручено: ${s.honors?.length || 0}${r.rehearsal ? ' · Репетиция: новые награды не сохраняются' : ''}`;
}
