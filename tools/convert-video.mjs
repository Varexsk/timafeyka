// Перекодировать ролики с iPhone так, чтобы их показывал браузер: `npm run video`.
//
// iPhone снимает в HEVC (H.265), да ещё и в 10-битном HDR. Chrome и Edge на
// Windows такое часто не декодируют: звук играет, а вместо картинки чёрный
// прямоугольник. Скрипт находит в media/ такие ролики, перекодирует их в
// H.264 .mp4 (его понимает любой браузер) и переставляет ссылки в программе
// на новые файлы. HDR при этом переводится в обычный цвет — иначе картинка
// выходит блёклой и серой.
//
// Оригиналы не удаляются: они переезжают в media/.originals/ — в кабинете
// эта папка не видна, но файлы на месте.
//
// Нужен ffmpeg. Поставить: `winget install Gyan.FFmpeg` и открыть новое окно.
//
//   npm run video            — перекодировать и поправить ссылки
//   npm run video -- --dry   — только показать, что будет сделано

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(ROOT, 'media');
const DATA = process.env.CIRK_DATA || path.join(ROOT, 'data');
const ORIGINALS = path.join(MEDIA, '.originals');
const PORT = Number(process.env.PORT) || 1717;
const BASE = 'http://localhost:' + PORT;
const DRY = process.argv.includes('--dry');

const VIDEO_EXT = ['.mp4', '.mov', '.m4v'];
// Кодеки, которые браузер на Windows может не показать.
const BAD_CODECS = ['hevc', 'h265'];
// HLG и PQ — это HDR. Без перевода в обычный цвет картинка сереет.
const HDR = ['arib-std-b67', 'smpte2084'];
const TONEMAP = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,'
  + 'tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

// winget кладёт ffmpeg сюда, но в PATH он появляется только в новом окне.
function findTool(name) {
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  const candidates = [exe];
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', exe));
  for (const c of candidates) {
    const r = spawnSync(c, ['-version'], { stdio: 'ignore' });
    if (!r.error && r.status === 0) return c;
  }
  return null;
}

function probe(ffprobe, file) {
  const r = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,color_transfer', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  try {
    const s = (JSON.parse(r.stdout).streams || [])[0];
    return s ? { codec: s.codec_name || '', transfer: s.color_transfer || '' } : null;
  } catch (e) {
    return null;
  }
}

function videos(dir, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) { out.push(...videos(path.join(dir, e.name), prefix + e.name + '/')); continue; }
    if (VIDEO_EXT.includes(path.extname(e.name).toLowerCase())) out.push(prefix + e.name);
  }
  return out;
}

// Куда положить результат: то же имя с .mp4, а если такое уже занято
// другим файлом — с припиской.
function targetFor(rel) {
  const base = rel.slice(0, -path.extname(rel).length);
  let name = base + '.mp4';
  let n = 2;
  while (fs.existsSync(path.join(MEDIA, name)) && name !== rel) name = `${base}-${n++}.mp4`;
  return name;
}

function convert(ffmpeg, src, dst, hdr) {
  const tmp = dst + '.part.mp4';
  const args = ['-v', 'error', '-y', '-i', src, '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', hdr ? TONEMAP : 'format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', tmp];
  const r = spawnSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (r.status !== 0) {
    try { fs.unlinkSync(tmp); } catch (e) { /* нечего убирать */ }
    throw new Error((r.stderr || '').trim().split('\n').slice(-2).join(' ') || 'ffmpeg завершился с ошибкой');
  }
  fs.renameSync(tmp, dst);
}

// Заменить пути в любом месте конкурса: у вопроса, у общего видео номера.
function swap(value, map) {
  if (typeof value === 'string') return map[value] || value;
  if (Array.isArray(value)) return value.map((v) => swap(v, map));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = swap(v, map);
    return out;
  }
  return value;
}

async function serverUp() {
  try {
    const r = await fetch(BASE + '/api/ping', { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch (e) {
    return false;
  }
}

// Сервер работает — правим через него, иначе он перезапишет файл своей копией.
// Не работает — правим сохранённую программу напрямую.
async function relink(map) {
  if (await serverUp()) {
    const state = await (await fetch(BASE + '/api/state?role=admin')).json();
    let n = 0;
    for (const contest of state.show.contests || []) {
      const next = swap(contest, map);
      if (JSON.stringify(next) === JSON.stringify(contest)) continue;
      const res = await (await fetch(BASE + '/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'saveContest', payload: { contest: next } })
      })).json();
      if (!res.ok) throw new Error('сервер не принял конкурс «' + contest.title + '»');
      n += 1;
    }
    return `через работающий сервер, конкурсов: ${n}`;
  }
  const file = path.join(DATA, 'show.json');
  if (!fs.existsSync(file)) return 'программа ещё не сохранялась — править нечего';
  const show = JSON.parse(fs.readFileSync(file, 'utf8'));
  const next = { ...show, contests: swap(show.contests || [], map) };
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  return 'в ' + path.relative(ROOT, file);
}

async function main() {
  const ffmpeg = findTool('ffmpeg');
  const ffprobe = findTool('ffprobe');
  if (!ffmpeg || !ffprobe) {
    console.log('Не найден ffmpeg. Поставь его командой:\n\n  winget install Gyan.FFmpeg\n\nи запусти `npm run video` в новом окне.');
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(MEDIA)) { console.log('Папки media/ нет — перекодировать нечего.'); return; }

  const todo = [];
  for (const rel of videos(MEDIA)) {
    const info = probe(ffprobe, path.join(MEDIA, rel));
    if (!info) { console.log(`  ?  ${rel} — не читается, пропускаю`); continue; }
    if (!BAD_CODECS.includes(info.codec)) { console.log(`  ✓  ${rel} — ${info.codec}, браузер покажет`); continue; }
    todo.push({ rel, hdr: HDR.includes(info.transfer) });
  }
  if (!todo.length) { console.log('\nВсе ролики уже в понятном браузеру формате.'); return; }

  console.log(`\nНужно перекодировать: ${todo.length}. ${DRY ? '(пробный прогон, ничего не меняю)' : 'Это займёт пару минут.'}`);
  const map = {};
  for (const t of todo) {
    const dst = targetFor(t.rel);
    console.log(`  →  ${t.rel} → ${dst}${t.hdr ? ' (HDR → обычный цвет)' : ''}`);
    if (DRY) continue;
    try {
      convert(ffmpeg, path.join(MEDIA, t.rel), path.join(MEDIA, dst), t.hdr);
    } catch (e) {
      console.log(`     не вышло: ${e.message}`);
      continue;
    }
    const keep = path.join(ORIGINALS, t.rel);
    fs.mkdirSync(path.dirname(keep), { recursive: true });
    fs.renameSync(path.join(MEDIA, t.rel), keep);
    map['media/' + t.rel] = 'media/' + dst;
  }
  if (DRY || !Object.keys(map).length) return;

  console.log('\nСсылки в программе поправлены ' + await relink(map) + '.');
  console.log('Оригиналы лежат в media/.originals/. В кабинете нажми «Обновить медиа».');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
