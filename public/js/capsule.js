import { send } from './bus.js';
const form = document.getElementById('letterForm'), status = document.getElementById('letterStatus'), another = document.getElementById('another');
let id, busy = false, saved = false;
const newId = () => 'letter-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
try { const draft = JSON.parse(localStorage.getItem('timofey-letter-draft') || 'null'); id = draft?.id; if (draft) for (const k of ['name','wish','prediction']) form.elements[k].value = draft[k] || ''; } catch {}
id ||= newId();
function persist() { try { localStorage.setItem('timofey-letter-draft', JSON.stringify({id,...Object.fromEntries(new FormData(form))})); } catch {} }
form.addEventListener('input', persist);
async function availability() {
  if (busy || saved) return;
  try { const r = await fetch('/api/state?role=play'); const s = await r.json(); const open = !!s.show?.capsule?.open; form.querySelector('button').disabled = !open; status.textContent = open ? 'Сбор писем открыт. Можно писать!' : 'Ведущий скоро откроет сбор писем. Пока можно подготовить текст.'; }
  catch { status.textContent = 'Нет связи с праздником. Текст остаётся в форме.'; }
}
form.addEventListener('submit', async e => {
  e.preventDefault(); if (busy || saved) return; busy = true; persist(); form.querySelector('button').disabled = true;
  const result = await send('capsuleLetter', {id,...Object.fromEntries(new FormData(form))}); busy = false;
  if (result.ok) { saved = true; form.hidden = true; another.hidden = false; status.textContent = 'Письмо сохранено. Спасибо за тёплые слова!'; try { localStorage.removeItem('timofey-letter-draft'); } catch {} }
  else { status.textContent = result.error || 'Не получилось отправить. Текст сохранён — попробуй ещё раз.'; form.querySelector('button').disabled = false; }
});
another.addEventListener('click', () => { saved = false; id = newId(); form.reset(); form.hidden = false; another.hidden = true; availability(); });
availability(); setInterval(availability,10000);
