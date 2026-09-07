// Качает звуки и музыку для показа. Только Public Domain и CC0 — атрибуция не требуется,
// но CREDITS.md всё равно пишем.
//
//   npm run audio
//
// Запускать можно сколько угодно раз: уже скачанные файлы пропускаются.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'CirkTimoshi/1.0 (local family party app; contact: local)';

const MANIFEST = [
  {
    to: 'media/sfx/applause.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Applause_i.ogg',
    page: 'https://commons.wikimedia.org/wiki/File:Applause_i.ogg',
    title: 'Applause i',
    license: 'Public domain',
    note: 'Овации, 17 с — на показе играем первые ~3 с.'
  },
  {
    to: 'media/sfx/drumroll.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Drum_Roll_Intro.ogg',
    page: 'https://commons.wikimedia.org/wiki/File:Drum_Roll_Intro.ogg',
    title: 'Drum Roll Intro',
    license: 'CC0',
    note: 'Барабанная дробь с ударом тарелки, 4 с — берём целиком.'
  },
  {
    to: 'media/sfx/tada.mp3',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Charge_-_Concert_Band_-_United_States_Air_Force_Heritage_of_America_Band.mp3',
    page: 'https://commons.wikimedia.org/wiki/File:Charge_-_Concert_Band_-_United_States_Air_Force_Heritage_of_America_Band.mp3',
    title: 'Charge — Concert Band, United States Air Force Heritage of America Band',
    license: 'Public domain',
    note: 'Фанфара духового оркестра, 11 с — на победе играем начало.'
  },
  {
    to: 'media/music/circus-march.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/b/ba/%22Thunder_and_Blazes%22_performed_by_the_United_States_Marine_Band.opus/%22Thunder_and_Blazes%22_performed_by_the_United_States_Marine_Band.opus.ogg',
    page: 'https://commons.wikimedia.org/wiki/File:%22Thunder_and_Blazes%22_performed_by_the_United_States_Marine_Band.opus',
    title: '«Thunder and Blazes» (Юлиус Фучик, «Выход гладиаторов») — United States Marine Band',
    license: 'Public domain',
    note: 'Тот самый цирковой марш, 139 с — фоном по кругу.'
  }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grab(entry) {
  const dest = path.join(ROOT, entry.to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`  уже есть  ${entry.to}`);
    return false;
  }

  const res = await fetch(entry.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${entry.url}`);

  // Сначала во временный файл: оборванная закачка не должна остаться как готовый звук.
  const tmp = dest + '.part';
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, dest);
  console.log(`  скачано   ${entry.to}  (${Math.round(fs.statSync(dest).size / 1024)} КБ)`);
  return true;
}

function writeCredits() {
  const lines = [
    '# Откуда взяты звуки',
    '',
    'Скачано скриптом `npm run audio` с Викисклада. Все файлы — Public Domain или CC0,',
    'указание автора не обязательно; список здесь для порядка.',
    ''
  ];
  for (const e of MANIFEST) {
    lines.push(`## ${e.to}`, '', `- ${e.title}`, `- Лицензия: ${e.license}`, `- Источник: ${e.page}`, `- ${e.note}`, '');
  }
  fs.writeFileSync(path.join(ROOT, 'media', 'CREDITS.md'), lines.join('\n'), 'utf8');
}

async function main() {
  console.log('Качаю звуки для показа…');
  let downloaded = 0;
  for (const entry of MANIFEST) {
    // Викисклад отвечает 429, если долбить его подряд без пауз.
    if (downloaded) await sleep(1200);
    try {
      if (await grab(entry)) downloaded++;
    } catch (err) {
      console.error(`  ОШИБКА    ${entry.to}: ${err.message}`);
    }
  }
  writeCredits();
  console.log('Готово. Файлы лежат в media/sfx и media/music.');
}

main();
