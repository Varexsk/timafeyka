'use strict';

// Реестр форматов конкурсов на стороне сервера.
//
// Формат — это по-прежнему один файл в public/js/types/. Браузер грузит его
// целиком, а сервер импортирует тот же самый файл и берёт из него только
// декларации: паспорт, правила начисления, чем участвуют гости, нужен ли
// таймер. Функции рендера сервер не вызывает никогда — ему не на чем рисовать.
//
// Поэтому у модуля есть правило: на верхнем уровне файла нельзя трогать
// document и window. Нарушение не роняет праздник — см. fallback ниже.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const DIR = path.join(__dirname, '..', 'public', 'js', 'types');

const registry = new Map();   // id -> декларация, её же отдаём браузеру
const servers = new Map();    // id -> своя серверная логика формата, если есть

function isTypeFile(name) {
  return name.endsWith('.js') && name !== 'index.js' && !name.startsWith('_');
}

// Что сервер берёт из модуля. Всё остальное — дело браузера.
function declare(id, file, mod) {
  return {
    id,
    file,
    label: mod.label || id,
    accent: mod.accent || '',
    icon: mod.icon || 'question',
    order: Number(mod.order) || 100,
    scoring: mod.scoring || { rule: 'manual' },
    participation: mod.participation || {},
    timer: mod.timer || null,
    revealAfterVideo: !!mod.revealAfterVideo,
    hasServer: false
  };
}

// Формат, который не читается на сервере, не должен ронять праздник: он
// продолжает работать на экране, на пульте и в кабинете. Отключается ровно
// одно — автоматическое начисление баллов, их ведущий поставит руками.
function fallback(id, file, why) {
  console.log('  формат «' + id + '» сервер прочитать не смог: ' + why);
  console.log('  он будет работать, но баллы за него начисляй вручную');
  return {
    id, file, label: id, accent: '', icon: 'question', order: 100,
    clientOnly: true, scoring: { rule: 'manual' }, participation: {}, timer: null,
    hasServer: false
  };
}

async function load() {
  registry.clear();
  servers.clear();

  let files;
  try {
    files = fs.readdirSync(DIR).filter(isTypeFile).sort();
  } catch (e) {
    throw new Error('не читается папка форматов ' + DIR + ' (' + e.message + ')');
  }

  for (const file of files) {
    const id = path.basename(file, '.js');
    let decl;
    try {
      const mod = (await import(pathToFileURL(path.join(DIR, file)).href)).default;
      if (!mod || !mod.id) throw new Error('в модуле нет поля id');
      if (mod.id !== id) throw new Error('id «' + mod.id + '» не совпадает с именем файла');
      decl = declare(id, file, mod);
    } catch (e) {
      decl = fallback(id, file, String(e.message).split('\n')[0]);
    }

    // Эскейп-люк: своя серверная логика формата, если деклараций не хватило.
    // Лежит рядом файлом <id>.server.mjs и браузеру не отдаётся.
    const side = path.join(DIR, id + '.server.mjs');
    if (fs.existsSync(side)) {
      try {
        const impl = (await import(pathToFileURL(side).href)).default;
        if (impl) { servers.set(id, impl); decl.hasServer = true; }
      } catch (e) {
        console.log('  серверная часть формата «' + id + '» сломана: ' + String(e.message).split('\n')[0]);
      }
    }

    registry.set(id, decl);
  }

  if (!registry.size) throw new Error('в ' + DIR + ' не нашлось ни одного формата');
  return registry.size;
}

// Порядок один и тот же везде: сначала order из модуля, потом по алфавиту.
function list() {
  return [...registry.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'ru'));
}

function get(id) {
  return registry.get(id) || null;
}

function server(id) {
  return servers.get(id) || null;
}

module.exports = { load, list, get, server };
