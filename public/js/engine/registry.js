// Реестр форматов конкурсов в браузере.
//
// Список файлов даёт сервер (/api/types) — прочитать папку браузер не умеет.
// Дальше каждый модуль подгружается динамическим import(). Новый формат —
// это просто новый файл в types/: здесь править ничего не нужно.

import { esc } from '../util.js';

const BY_ID = new Map();     // рабочие форматы
const MISSING = new Map();   // заглушки для типов, которых нет вовсе
let ORDER = [];

// Если сервер почему-то не ответил — показ важнее аккуратности,
// поднимаем те форматы, что были в проекте изначально.
const BUILTIN = ['quiz', 'bets', 'videoChoice', 'photoGuess',
  'quotes', 'trueFalse', 'audioGuess', 'challenge'];

// Заглушка вместо формата: ведущий видит понятную причину, а не пустой экран,
// и может пропустить номер. Данные вопросов при этом никуда не деваются.
function stub(id, headline, why) {
  const note = why ? `<div class="hint">${esc(why)}</div>` : '';
  return {
    id,
    label: id,
    accent: '#8A8A8A',
    icon: 'question',
    order: 999,
    broken: why || headline,
    prop: { intro: 'mic', question: '', reveal: 'star' },
    editor: {},
    newItem() { return { id: '', q: 'Новый вопрос' }; },
    stage() {
      return `<div class="answer-empty">${esc(headline)}</div>${note}
        <div class="hint">Жми «Дальше» — перейдём к следующему номеру.</div>`;
    },
    remote() {
      return `<div class="r-answer is-empty">
          <span class="r-answer-label">Формат не загрузился</span>
          <span class="r-answer-text">${esc(id)}</span>
        </div>
        ${why ? `<div class="r-note">${esc(why)}</div>` : ''}
        <div class="r-note">Пропусти этот конкурс кнопкой «Дальше».</div>`;
    }
  };
}

export async function loadTypes() {
  let list = [];
  try {
    const data = await fetch('/api/types').then((r) => r.json());
    list = data.types || [];
  } catch (e) {
    console.error('Сервер не отдал список форматов, поднимаю встроенные:', e);
  }
  if (!list.length) list = BUILTIN.map((id) => ({ id, file: id + '.js' }));

  // Один битый модуль не должен ронять весь показ — грузим все и разбираем итоги.
  const loaded = await Promise.allSettled(list.map((t) => import('../types/' + t.file)));

  BY_ID.clear();
  MISSING.clear();
  ORDER = [];
  list.forEach((meta, i) => {
    const r = loaded[i];
    const mod = r.status === 'fulfilled' ? r.value.default : null;
    if (mod && mod.id) {
      BY_ID.set(mod.id, mod);
      ORDER.push(mod);
      return;
    }
    const why = r.status === 'rejected'
      ? String((r.reason && r.reason.message) || r.reason)
      : 'в модуле нет поля id';
    console.error(`Формат «${meta.id}» не загрузился: ${why}`);
    const broken = stub(meta.id, `Формат «${meta.id}» не загрузился`, why);
    BY_ID.set(meta.id, broken);
    ORDER.push(broken);
  });

  return ORDER;
}

// Все форматы в порядке, который задал сервер (order из модуля).
export function types() {
  return ORDER;
}

export function hasType(id) {
  return BY_ID.has(id);
}

export function getType(id) {
  const t = BY_ID.get(id);
  if (t) return t;
  // Раньше здесь молча возвращалась викторина — и конкурс с опечаткой в типе
  // рисовался ею, притворяясь рабочим. Теперь ошибка видна.
  if (!MISSING.has(id)) {
    console.error(`Неизвестный формат конкурса: «${id}». Проверь поле type в программе.`);
    MISSING.set(id, stub(id, `Неизвестный формат конкурса: «${id}»`,
      'Такого файла нет в public/js/types/'));
  }
  return MISSING.get(id);
}
