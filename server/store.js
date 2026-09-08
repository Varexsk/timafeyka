'use strict';

const fs = require('fs');
const path = require('path');
const seed = require('./seed');
const migrate = require('./migrate');

// Обычно состояние лежит в data/ рядом с проектом. Переменная нужна тестам,
// чтобы гонять команды на временной копии и не портить настоящий праздник.
const DATA = process.env.CIRK_DATA || path.join(__dirname, '..', 'data');
const FILES = { show: 'show.json', guests: 'guests.json', runtime: 'runtime.json' };

function readJson(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeJson(name, value) {
  const target = path.join(DATA, name);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, target); // атомарная замена: нельзя получить обрезанный файл
}

const store = {
  version: 1,
  // Своя версия у каждого среза: страница получает только то, что у неё
  // устарело. Иначе на каждый ответ гостя всем уходил бы весь снимок.
  versions: { show: 1, guests: 1, runtime: 1 },
  show: null,
  guests: null,
  runtime: null,
  _pending: new Set(),
  _timer: null,

  load() {
    if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
    this.show = readJson(FILES.show) || clone(seed.show);
    this.guests = readJson(FILES.guests) || clone(seed.guests);
    this.runtime = Object.assign(clone(seed.runtime), readJson(FILES.runtime) || {});
    // Старые данные (эмодзи вместо картинок, отсутствие семей) переводим на новые поля.
    if (!Array.isArray(this.guests.teams)) this.guests.teams = clone(seed.guests.teams);
    if (!this.show.mode) this.show.mode = 'teams';

    migrate.migrateGuests(this.guests.list);
    migrate.migrateShow(this.show);
    migrate.migrateRuntime(this.runtime, this.show);
    // На старте ничего не воспроизводим сами: команда видео должна прийти от экрана.
    this.runtime.fx = { type: '', seq: 0 };
    this.runtime.music = { on: false, seq: 0 };
    this.markAll();
    this.flush();
  },

  snapshot() {
    return {
      version: this.version,
      show: this.show,
      guests: this.guests.list,
      teams: this.guests.teams,
      runtime: this.runtime
    };
  },

  touch(...keys) {
    this.version += 1;
    for (const k of keys) {
      if (this.versions[k] !== undefined) this.versions[k] += 1;
      this._pending.add(k);
    }
    if (!this._timer) this._timer = setTimeout(() => this.flush(), 300);
  },

  markAll() {
    for (const k of Object.keys(FILES)) {
      if (this.versions[k] !== undefined) this.versions[k] += 1;
      this._pending.add(k);
    }
  },

  flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    for (const key of this._pending) {
      try {
        writeJson(FILES[key], key === 'guests' ? this.guests : this[key]);
      } catch (e) {
        console.error('Не смог сохранить', FILES[key], e.message);
      }
    }
    this._pending.clear();
  },

  resetToSeed() {
    this.show = clone(seed.show);
    this.guests = clone(seed.guests);
    this.runtime = clone(seed.runtime);
    this.version += 1;
    this.markAll();
    this.flush();
  }
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

module.exports = { store, clone };
