'use strict';

// Разовый перевод старых данных на новые поля: у гостей emoji -> avatar,
// у вариантов ответа emoji -> icon. Нужен только тем, кто успел поработать
// в кабинете до редизайна; на свежих данных ничего не делает.

const GUEST = {
  '\u{1F418}': 'elephant', '\u{1F43B}': 'bear', '\u{1F43C}': 'panda', '\u{1F98A}': 'fox',
  '\u{1F42F}': 'tiger', '\u{1F993}': 'zebra', '\u{1F435}': 'monkey', '\u{1F9AD}': 'seal',
  '\u{1F992}': 'giraffe', '\u{1F429}': 'poodle', '\u{1F99D}': 'raccoon', '\u{1F99C}': 'parrot',
  '\u{1F43F}️': 'monkey', '\u{1F98C}': 'giraffe', '\u{1F428}': 'bear', '\u{1F994}': 'raccoon'
};

const ART = {
  '\u{1F319}': 'moon', '\u{1F305}': 'sunrise', '☀️': 'sun', '\u{1F306}': 'evening',
  '⚖️': 'scales', '\u{1F4CF}': 'ruler',
  '1️⃣': 'num-1', '2️⃣': 'num-2', '3️⃣': 'num-3', '4️⃣': 'num-4',
  '5️⃣': 'num-5', '6️⃣': 'num-6', '7️⃣': 'num-7',
  '\u{1F463}': 'footprints', '\u{1F41B}': 'crawling', '\u{1F9B7}': 'tooth',
  '\u{1F469}': 'mom', '\u{1F468}': 'dad', '\u{1F476}': 'baby', '\u{1F91D}': 'both',
  '\u{1F9F8}': 'teddy', '\u{1F4F1}': 'phone', '\u{1F34C}': 'banana', '\u{1F36A}': 'cookie',
  '\u{1F50A}': 'speaker', '\u{1F6B6}': 'walking', '\u{1F697}': 'car', '\u{1FA86}': 'doll',
  '\u{1F963}': 'bowl', '\u{1F955}': 'carrot'
};

const ANIMALS = ['elephant', 'bear', 'panda', 'fox', 'tiger', 'zebra',
  'monkey', 'seal', 'giraffe', 'poodle', 'raccoon', 'parrot'];

function migrateGuests(list) {
  let changed = false;
  (list || []).forEach((g, i) => {
    if (g.avatar) return;
    g.avatar = GUEST[g.emoji] || ANIMALS[i % ANIMALS.length];
    delete g.emoji;
    changed = true;
  });
  return changed;
}

function migrateShow(show) {
  let changed = false;

  // Название цирка стало полем настроек — раньше оно было вшито в экраны.
  // Склонять чужое имя автоматически нельзя, поэтому ставим значение
  // по умолчанию: в кабинете его можно переписать целиком.
  if (show && show.title === undefined) {
    show.title = 'Цирк Тимоши';
    changed = true;
  }

  if (show && show.playMode === undefined) {
    show.playMode = 'host';
    changed = true;
  }

  // «Письмо в будущее» убрали из праздника целиком — хвосты в данных не нужны.
  if (show && show.capsule !== undefined) {
    delete show.capsule;
    changed = true;
  }

  for (const contest of (show && show.contests) || []) {
    for (const item of contest.items || []) {
      for (const opt of item.options || []) {
        if (!opt || opt.icon !== undefined || opt.emoji === undefined) continue;
        opt.icon = ART[opt.emoji] || '';
        delete opt.emoji;
        changed = true;
      }
    }
  }
  return changed;
}

// Позиция в показе раньше хранилась номерами в отфильтрованном списке.
function migrateRuntime(runtime, show) {
  if (!runtime) return false;
  let changed = false;

  const active = ((show && show.contests) || []).filter((c) => c.enabled !== false);
  const toIds = (obj) => {
    const contest = active[Number(obj.contestIndex) || 0] || active[0] || null;
    obj.contestId = contest ? contest.id : '';
    const items = (contest && contest.items) || [];
    const item = items[Number(obj.itemIndex) || 0] || items[0] || null;
    obj.itemId = item ? item.id : '';
    delete obj.contestIndex;
    delete obj.itemIndex;
  };

  if (runtime.contestIndex !== undefined || runtime.contestId === undefined) {
    toIds(runtime);
    changed = true;
  }
  // Тот же перевод для снимка репетиции, если он остался с прошлого запуска.
  if (runtime.rehearsal && runtime.rehearsal.contestIndex !== undefined) {
    toIds(runtime.rehearsal);
    changed = true;
  }
  // Ставки жили отдельным хранилищем и никогда не чистились. Переносим их
  // в общие раунды: ключ тот же — «конкурс/вопрос».
  if (runtime.bets && typeof runtime.bets === 'object') {
    runtime.rounds = runtime.rounds || {};
    runtime.roundOrder = Array.isArray(runtime.roundOrder) ? runtime.roundOrder : [];
    for (const key of Object.keys(runtime.bets)) {
      const votes = {};
      for (const ownerId of Object.keys(runtime.bets[key] || {})) {
        votes[ownerId] = { v: Number(runtime.bets[key][ownerId]), at: 0 };
      }
      if (!Object.keys(votes).length) continue;
      runtime.rounds[key] = { votes, awarded: false, gen: 0 };
      if (!runtime.roundOrder.includes(key)) runtime.roundOrder.push(key);
    }
    delete runtime.bets;
    changed = true;
  }
  if (runtime.capsuleStage !== undefined) {
    delete runtime.capsuleStage;
    changed = true;
  }
  if (!runtime.rounds) { runtime.rounds = {}; changed = true; }
  if (!Array.isArray(runtime.roundOrder)) { runtime.roundOrder = []; changed = true; }

  // Последнее начисление раньше было одиночным: {id, delta}. Теперь их может
  // быть несколько сразу (например, при ничьей), поэтому это список.
  const last = runtime.lastAward;
  if (last && last.entries === undefined) {
    runtime.lastAward = { seq: last.seq || 1, entries: [{ id: last.id, delta: last.delta }] };
    changed = true;
  }
  if (!Array.isArray(runtime.awardLog)) {
    runtime.awardLog = [];
    changed = true;
  }

  return changed;
}

module.exports = { migrateGuests, migrateShow, migrateRuntime };
