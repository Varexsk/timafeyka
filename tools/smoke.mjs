// Прогон всей программы одной командой: `npm run smoke`.
//
// Скрипт проходит показ от заставки до диплома — каждый конкурс, каждый
// вопрос, обе фазы — и печатает, где что не так. Это не замена репетиции
// (звук, музыку и телефоны он не проверит), но за пятнадцать секунд ловит
// то, ради чего иначе пришлось бы двести раз нажать «Дальше».
//
// Работает через репетицию: баллы и место в программе возвращаются на
// место, поэтому запускать можно хоть посреди праздника.

const PORT = Number(process.env.PORT) || 1717;
const BASE = 'http://localhost:' + PORT;

const problems = [];
let checks = 0;

function note(what) {
  problems.push(what);
}

function check(ok, what) {
  checks += 1;
  if (!ok) note(what);
  return ok;
}

async function send(type, payload) {
  const res = await fetch(BASE + '/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload: payload || {} })
  });
  const out = await res.json();
  check(out.ok, `команда «${type}» вернула ошибку: ${out.error || res.status}`);
  return out;
}

function state() {
  return fetch(BASE + '/api/state?role=tv').then((r) => r.json());
}

function label(contest, item, phase) {
  const where = item ? ` · вопрос «${String(item.q || '').slice(0, 30)}»` : '';
  return `${contest.title}${where} (${phase})`;
}

async function main() {
  let snap;
  try {
    snap = await state();
  } catch (e) {
    console.log('');
    console.log('  Сервер не отвечает на ' + BASE);
    console.log('  Запусти его (start.cmd или npm start) и повтори.');
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log('  Прогон программы «' + (snap.show.title || 'Цирк') + '»');
  console.log('  ─────────────────────────────────────────────');

  // Репетиция вернёт и баллы, и место в программе.
  await send('rehearsal', { on: true });

  try {
    const contests = (snap.show.contests || []).filter((c) => c.enabled !== false);
    check(contests.length > 0, 'ни одного включённого конкурса');

    for (const screen of ['welcome', 'guests']) {
      await send('goScreen', { screen });
      const now = await state();
      check(now.runtime.screen === screen, `экран «${screen}» не открылся`);
    }

    for (const contest of contests) {
      const items = contest.items || [];
      if (!items.length) {
        note(`${contest.title}: ни одного вопроса — конкурс пропустится`);
      }

      await send('goto', { contestId: contest.id, phase: 'intro' });
      const intro = await state();
      check(intro.runtime.contestId === contest.id, `${contest.title}: не открылась афиша`);
      check(!!(contest.title || '').trim(), `${contest.title || contest.id}: нет названия`);

      for (const item of items) {
        for (const phase of ['question', 'reveal']) {
          await send('goto', { contestId: contest.id, itemId: item.id, phase });
          const now = await state();
          check(now.runtime.itemId === item.id, `${label(contest, item, phase)}: не открылся`);
          check(now.runtime.phase === phase, `${label(contest, item, phase)}: фаза не сменилась`);
        }
      }
      process.stdout.write('  ' + contest.title + ': ' + items.length + ' — ок\n');
    }

    for (const screen of ['leaderboard', 'finale', 'diploma']) {
      await send('goScreen', { screen });
      const now = await state();
      check(now.runtime.screen === screen, `экран «${screen}» не открылся`);
    }

    // Мелочи, которые тоже жалко обнаружить на празднике.
    const teams = (snap.teams || []).length;
    const guests = (snap.guests || []).length;
    if ((snap.show.mode || 'teams') === 'teams' && !teams) note('нет ни одной семьи, а баллы считаются семьям');
    if ((snap.show.mode || 'teams') === 'guests' && !guests) note('нет ни одного гостя, а баллы считаются гостям');
    if (snap.show.playMode === 'phones' && !guests && !teams) note('режим телефонов включён, но играть некому');
  } finally {
    await send('rehearsal', { on: false });
  }

  console.log('  ─────────────────────────────────────────────');
  if (!problems.length) {
    console.log('  Проверок: ' + checks + '. Всё прошло без замечаний.');
    console.log('  Место в программе и баллы вернулись как были.');
    console.log('');
    return;
  }

  console.log('  Проверок: ' + checks + '. Замечаний: ' + problems.length);
  console.log('');
  for (const p of problems) console.log('   • ' + p);
  console.log('');
  process.exit(1);
}

main().catch((e) => {
  console.log('');
  console.log('  Прогон сорвался: ' + e.message);
  console.log('');
  process.exit(1);
});
