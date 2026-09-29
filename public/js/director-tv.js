import { serverNow } from './bus.js';
import { esc } from './util.js';
import { qrSvg } from './lib/qr.js';
import * as confetti from './confetti.js';
let lastKey = '', explicit = 0, actionTimer, breakWas = false, pausedMedia = [], albumUrl = '', lastCeremony = 0;
let covered = false;
document.addEventListener('theater:reveal', () => {
  const stage = document.getElementById('stage');
  if (!covered && (stage?.dataset.screen !== 'show' || stage?.dataset.phase === 'intro')) act('enter');
});
fetch('/api/net').then(r=>r.json()).then(n=>{ albumUrl = (n.playUrl || location.origin + '/play').replace(/\/play$/, '/album'); }).catch(()=>{});
function act(kind) {
  const lion = document.querySelector('.lion-wrap'); if (!lion) return;
  clearTimeout(actionTimer); delete lion.dataset.act; void lion.offsetWidth; lion.dataset.act = kind;
  actionTimer = setTimeout(()=>{ delete lion.dataset.act; }, kind === 'enter' ? 3200 : 4500);
}
export function updateDirectorTV(state) {
  const r = state.runtime;
  document.body.classList.toggle('theater-full', state.show.director?.motion !== 'calm');
  document.body.classList.toggle('theater-calm', state.show.director?.motion === 'calm');
  if (r.intermission?.open && !breakWas) {
    pausedMedia = [...document.querySelectorAll('#screen video, #screen audio')].filter(m=>!m.paused && !m.ended);
    pausedMedia.forEach(m=>m.pause());
  } else if (!r.intermission?.open && breakWas) {
    pausedMedia.filter(m=>m.isConnected).forEach(m=>m.play().catch(()=>{})); pausedMedia = [];
  }
  breakWas = !!r.intermission?.open;
  const cover = !!(r.intermission?.open || r.ceremony?.open || r.albumStage?.open);
  if (cover && !covered) document.querySelectorAll('#screen video, #screen audio').forEach(m=>m.pause());
  covered = cover;
  const key = `${r.screen}/${r.contestId}/${r.phase}`;
  if (r.lionAct?.seq && explicit !== r.lionAct.seq) { explicit = r.lionAct.seq; if (serverNow() - r.lionAct.at < 5000) act(r.lionAct.kind); }
  else if (key !== lastKey && !r.intermission?.open && !document.getElementById('stage').classList.contains('is-curtain')) {
    if (r.screen !== 'show' || r.phase !== 'question') act(r.phase === 'reveal' ? 'surprise' : r.screen === 'finale' ? 'clap' : 'enter');
  }
  lastKey = key;
  const hero = !!r.ceremony?.open;
  document.body.classList.toggle('director-hero', hero);
  document.body.classList.toggle('director-break', !!r.intermission?.open);
  if (hero && r.ceremony.seq !== lastCeremony) { lastCeremony = r.ceremony.seq; if (serverNow() - r.ceremony.startedAt < 5000) confetti.fountain(140); }
}
export function paintDirector(state, overlay) {
  if (!state) return false;
  const r = state.runtime;
  let key, html, cls;
  if (r.intermission?.open) {
    const c = state.show.contests.find(c=>c.id === state.show.director?.breakAlbum);
    const frames = (c?.items || []).filter(i=>i.media);
    const index = frames.length ? Math.floor((serverNow() - r.intermission.at) / 8000) % frames.length : 0;
    const f = frames[index]; key = `break/${r.intermission.seq}/${index}/${f?.media || ''}`; cls = 'director-intermission';
    html = `<p class="party-kicker">ЦИРК ТИМОШИ</p><h1>Антракт</h1><p>Обнимаемся, отдыхаем и набираемся сил</p>${f ? `<img class="break-photo" src="${esc(f.media)}" alt="${esc(f.q || 'Семейная фотография')}"><p>${esc(f.q || '')}</p>` : '<div class="break-emblem">✦<span>Скоро продолжим<br>наше представление</span>✦</div>'}<p class="director-footnote">Артисты отдыхают · Все конкурсы на паузе</p>`;
  } else if (r.ceremony?.open) {
    key = `honor/${r.ceremony.seq}`; cls = 'director-ceremony';
    html = `<p class="party-kicker">АПЛОДИСМЕНТЫ НАШЕМУ АРТИСТУ</p><div class="ceremony-card"><p>ПОЧЁТНЫЙ БИЛЕТ</p><h1>${esc(r.ceremony.title)}</h1><strong>${esc(r.ceremony.name)}</strong><div class="ceremony-seal">★</div><small>Первый день рождения Тимофея</small></div>`;
  } else if (r.albumStage?.open) {
    const url = albumUrl || location.origin + '/album';
    const shots = state.show.booth?.length || 0;
    key = `album/${url}/${shots}`; cls = 'director-qrstage';
    html = `<p class="party-kicker">НА ПАМЯТЬ</p><h1>Семейный альбом</h1><p>Фотографии и звёздочки этого вечера</p><div class="stage-qr">${qrSvg(url,{dark:'#412b41',light:'#fffaf0'})}</div><p>${esc(url)}</p><p>Фотографий: ${shots}</p>`;
  } else { delete overlay.dataset.director; return false; }
  overlay.hidden = false;
  if (overlay.dataset.director !== key) { overlay.dataset.director = key; overlay.className = `party-overlay ${cls}`; overlay.innerHTML = html; }
  document.body.classList.add('party-overlay-open');
  return true;
}
