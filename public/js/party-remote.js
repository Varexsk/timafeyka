import { send, serverNow } from './bus.js';
import { esc } from './util.js';

let state, files = [], root, rosterKey = '';
const moods = ['Все треки', 'Встреча гостей', 'Конкурсы', 'Танцы', 'Торт', 'Тёплые моменты'];
let groups = {};
try { groups = JSON.parse(localStorage.getItem('party-track-groups') || '{}'); } catch {}
const command = async (type, p) => {
  const result = await send(type, p);
  if (!result.ok) root.querySelector('[data-status]').textContent = 'Команда не дошла. Проверь связь и повтори.';
};
const tracks = () => files.filter(f => f.kind === 'audio' && !f.name.startsWith('sfx/'));
const visibleTracks = () => tracks().filter(f => root.querySelector('[data-mood]').value === moods[0] || groups[f.path] === root.querySelector('[data-mood]').value);

function refreshTracks() {
  const select = root.querySelector('[data-track]');
  const previous = select.value || state?.runtime.dj?.src;
  select.innerHTML = '<option value="">Выбери трек</option>' + visibleTracks().map(f => `<option value="${esc(f.path)}">${esc(f.name)}</option>`).join('');
  if ([...select.options].some(o => o.value === previous)) select.value = previous;
  root.querySelector('[data-status]').textContent = tracks().length ? `${tracks().length} треков · звук идёт с экрана ТВ` : 'Загрузи музыку и фотографии в кабинете → Медиа, затем обнови список.';
}

export function mountPartyRemote() {
  root = document.createElement('section'); root.className = 'card party-console';
  root.innerHTML = `<h3>Режиссёрская</h3>
    <div class="party-tabs" role="tablist"><button class="btn is-on" data-tab="dj">DJ-пульт</button><button class="btn" data-tab="photos">Фото</button><button class="btn" data-tab="draw">Участники</button></div>
    <div data-pane="dj"><p class="party-eyebrow">МУЗЫКА ПРАЗДНИКА</p><strong data-now>Ничего не играет</strong>
      <label>Плейлист<select data-mood>${moods.map(m => `<option>${m}</option>`).join('')}</select></label>
      <label>Трек<select data-track></select></label><p class="r-note">На телевизоре один раз нажми «Включить звук».</p>
      <div class="party-row"><button class="btn btn--primary" data-do="play">Включить</button><button class="btn" data-do="pause">Пауза</button><button class="btn" data-do="next">Следующий</button></div>
      <div class="party-row"><button class="btn" data-do="back">−10 с</button><span data-position>0:00</span><button class="btn" data-do="forward">+10 с</button></div>
      <label>Громкость<input data-volume type="range" min="0" max="100" value="35"></label>
      <div class="party-row"><button class="btn btn--teal" data-do="talk">Говорю</button><button class="btn" data-do="loop">Повтор трека</button></div>
      <details><summary>Добавить выбранный трек в плейлист</summary><select data-group>${moods.slice(1).map(m => `<option>${m}</option>`).join('')}</select><button class="btn" data-do="group">Добавить</button><p class="r-note">Распределение по плейлистам хранится на этом пульте.</p></details>
      <div class="party-row"><button class="btn" data-fx="drumroll">Дробь</button><button class="btn" data-fx="tada">Фанфары</button><button class="btn" data-fx="applause">Овации</button></div>
      <button class="btn btn--primary btn--wide" data-do="silence">Остановить весь звук</button>
    </div>
    <div data-pane="photos" hidden><p class="party-eyebrow">ПЕРВЫЙ ГОД ТИМОФЕЯ</p>
      <label>Альбом<select data-album></select></label>
      <label>Секунд на фотографию<input type="number" data-seconds min="3" max="60" value="6"></label>
      <label><input type="checkbox" data-photo-loop checked> Повторять альбом</label>
      <p class="r-note">Альбомы берутся из номеров «Год за минуту». Музыку выбери во вкладке DJ — она продолжится при показе фото.</p>
      <div class="party-row"><button class="btn btn--primary" data-do="album">Показать альбом</button><button class="btn" data-do="photo-pause">Пауза / продолжить</button></div>
      <button class="btn btn--teal btn--wide" data-do="booth">Показать фотобудку гостей</button>
      <div class="party-row"><button class="btn" data-do="photo-prev">Предыдущее</button><button class="btn" data-do="photo-next">Следующее</button></div>
      <button class="btn btn--wide" data-do="photo-close">Вернуться к конкурсу</button>
    </div>
    <div data-pane="draw" hidden><p class="party-eyebrow">КОГО ЗОВЁМ НА АРЕНУ?</p>
      <div class="party-row"><button class="btn" data-do="all">Выбрать всех</button><button class="btn" data-do="none">Снять выбор</button></div>
      <div data-candidates class="party-candidates"></div>
      <label><input type="checkbox" data-exclude checked> Не повторять уже выступавших</label>
      <p data-draw-info class="r-note"></p>
      <div class="party-row"><button class="btn btn--primary" data-do="one">Выбрать одного</button><button class="btn btn--purple" data-do="pair">Выбрать пару</button></div>
      <div class="party-row"><button class="btn" data-do="draw-close">Закрыть колесо</button><button class="btn" data-do="reset">Сбросить историю</button></div>
    </div><p data-status class="r-note" role="status"></p><button class="btn btn--ghost" data-do="refresh">Обновить медиа</button>`;
  document.getElementById('cardNow').after(root);
  const refresh = async () => { try { const r = await fetch('/api/media'); if (!r.ok) throw Error(); files = (await r.json()).files || []; refreshTracks(); } catch { root.querySelector('[data-status]').textContent = 'Не удалось загрузить медиа. Нажми «Обновить медиа».'; } };
  root.addEventListener('change', e => {
    if (e.target.matches('[data-mood]')) refreshTracks();
    if (e.target.matches('[data-volume]')) command('dj', { volume: Number(e.target.value) / 100 });
    if (e.target.matches('[data-album]')) {
      const c = state?.show.contests.find(c => c.id === e.target.value);
      root.querySelector('[data-seconds]').value = c?.slideSeconds || 6;
    }
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || !state) return;
    if (b.dataset.tab) { root.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== b.dataset.tab); root.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('is-on', t === b)); return; }
    if (b.dataset.fx) { command('fx', { type: b.dataset.fx }); return; }
    const d = state.runtime.dj || {}, a = state.runtime.album || {};
    const selected = root.querySelector('[data-track]').value;
    const act = b.dataset.do;
    if (act === 'refresh') return refresh();
    if (act === 'play' && selected) command('dj', { src: selected, playing: true });
    if (act === 'pause') command('dj', { playing: !d.playing });
    if (act === 'next') { const list = visibleTracks(); const f = list[(list.findIndex(f => f.path === d.src) + 1) % list.length]; if (f) { root.querySelector('[data-track]').value = f.path; command('dj', { src: f.path, playing: true }); } }
    if (act === 'back' || act === 'forward') command('dj', { position: Math.max(0, currentPosition(d) + (act === 'back' ? -10 : 10)) });
    if (act === 'talk') command('dj', { talking: !d.talking });
    if (act === 'loop') command('dj', { loop: !d.loop });
    if (act === 'silence') command('partySilence');
    if (act === 'group' && selected) { groups[selected] = root.querySelector('[data-group]').value; try { localStorage.setItem('party-track-groups', JSON.stringify(groups)); } catch {} refreshTracks(); }
    if (act === 'album') {
      const c = state.show.contests.find(c => c.id === root.querySelector('[data-album]').value);
      const frames = c ? c.items.filter(i => i.media).map(i => ({ src: i.media, caption: i.q })) : files.filter(f => f.kind === 'photo').map(f => ({ src: f.path, caption: '' }));
      if (!frames.length) { root.querySelector('[data-status]').textContent = 'В альбоме пока нет фотографий. Добавь их в кабинете.'; return; }
      if (c?.soundtrack) await command('dj', { src: c.soundtrack, playing: true });
      command('album', { frames, open: true, playing: true, seconds: Number(root.querySelector('[data-seconds]').value), loop: root.querySelector('[data-photo-loop]').checked });
    }
    // Снимки, которые гости прислали со своих телефонов. Показываем свежие
    // первыми: их только что сделали, их и хотят увидеть.
    if (act === 'booth') {
      const shots = (state.show.booth || []).slice().reverse();
      if (!shots.length) { root.querySelector('[data-status]').textContent = 'Гости ещё не прислали ни одного кадра.'; return; }
      command('album', {
        frames: shots.map(p => ({ src: p.src, caption: p.by || '' })),
        open: true, playing: true,
        seconds: Number(root.querySelector('[data-seconds]').value),
        loop: root.querySelector('[data-photo-loop]').checked
      });
    }
    if (act === 'photo-pause') command('album', { playing: !a.playing });
    if (act === 'photo-prev' || act === 'photo-next') command('album', { delta: act === 'photo-prev' ? -1 : 1 });
    if (act === 'photo-close') command('album', { open: false });
    if (act === 'all' || act === 'none') root.querySelectorAll('[data-guest]').forEach(c => c.checked = act === 'all');
    if (act === 'reset' || act === 'draw-close') command('partyDraw', act === 'reset' ? { reset: true } : { close: true });
    if (act === 'one' || act === 'pair') {
      const excludeUsed = root.querySelector('[data-exclude]').checked;
      const ids = [...root.querySelectorAll('[data-guest]:checked')].map(c => c.value);
      const available = ids.filter(id => !excludeUsed || !(state.runtime.partyDraw?.used || []).includes(id));
      if (available.length < (act === 'pair' ? 2 : 1)) { root.querySelector('[data-draw-info]').textContent = 'Недостаточно участников: отметь гостей или сбрось историю.'; return; }
      command('partyDraw', { ids, count: act === 'pair' ? 2 : 1, excludeUsed });
    }
  });
  refresh();
  setInterval(() => { if (state) updateClock(); }, 500);
}
function currentPosition(d) { return (d.position || 0) + (d.playing ? Math.max(0, (serverNow() - d.startedAt) / 1000) : 0); }
function updateClock() {
  const d = state.runtime.dj || {}, sec = Math.floor(currentPosition(d));
  root.querySelector('[data-position]').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const w = state.runtime.partyDraw;
  root.querySelectorAll('[data-do="one"], [data-do="pair"]').forEach(b => b.disabled = !!(w?.open && serverNow() < w.endsAt));
}
export function updatePartyRemote(next) {
  state = next; if (!root) return;
  const d = state.runtime.dj || {};
  root.querySelector('[data-now]').textContent = d.src ? `${d.playing ? 'Играет' : 'Пауза'} · ${files.find(f => f.path === d.src)?.name || d.src.split('/').pop()}` : 'Ничего не играет';
  root.querySelector('[data-do="pause"]').textContent = d.playing ? 'Пауза' : 'Продолжить';
  for (const [act, flag] of [['talk', d.talking], ['loop', d.loop]]) root.querySelector(`[data-do="${act}"]`).classList.toggle('is-on', !!flag);
  if (document.activeElement !== root.querySelector('[data-volume]')) root.querySelector('[data-volume]').value = (d.volume ?? .35) * 100;
  const guests = state.guests || [];
  const key = JSON.stringify(guests.map(g => [g.id, g.name, g.playing]));
  if (key !== rosterKey) {
    const previous = new Map([...root.querySelectorAll('[data-guest]')].map(c => [c.value, c.checked]));
    rosterKey = key;
    // Отмечены те, кто играет: остальных ведущий может добавить руками,
    // но по умолчанию колесо их не вызывает.
    root.querySelector('[data-candidates]').innerHTML = guests.map(g => {
      const was = previous.get(g.id);
      const on = was === undefined ? g.playing !== false : was;
      return `<label class="${g.playing === false ? 'is-fan' : ''}"><input type="checkbox" data-guest value="${esc(g.id)}" ${on ? 'checked' : ''}>${esc(g.name)}${g.playing === false ? ' · болеет' : ''}</label>`;
    }).join('') || '<p>Добавь гостей в кабинете.</p>';
  }
  const select = root.querySelector('[data-album]'), value = select.value;
  select.innerHTML = '<option value="">Все загруженные фотографии</option>' + state.show.contests.filter(c => c.type === 'slideshow').map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join(''); select.value = value;
  const w = state.runtime.partyDraw;
  root.querySelector('[data-draw-info]').textContent = `Уже выбрано: ${w?.used?.length || 0}`;
  updateClock();
}
