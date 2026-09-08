// Связь с сервером: поток состояния (SSE) в одну сторону, команды (POST) в другую.
//
// Сервер шлёт не весь снимок целиком, а только те срезы, которые у этой
// страницы устарели. Здесь они склеиваются обратно в одно состояние, поэтому
// снаружи ничего не меняется: onState по-прежнему отдаёт целую картину.

let onStateCb = () => {};
let onStatusCb = () => {};
let source = null;
let watchdog = 0;

let state = null;
let skew = 0;   // насколько часы сервера впереди наших

const SLICES = ['show', 'guests', 'teams', 'runtime'];

export function send(type, payload) {
  return fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload: payload || {} })
  })
    .then((r) => r.json())
    .catch(() => ({ ok: false }));
}

export function onState(cb) { onStateCb = cb; }
export function onStatus(cb) { onStatusCb = cb; }

// Время по часам сервера. Все страницы считают одинаково, даже если у телефона
// часы сбиты, — это понадобится таймеру конкурса.
export function serverNow() {
  return Date.now() + skew;
}

function merge(frame) {
  if (!state) state = {};
  for (const key of SLICES) {
    if (frame[key] !== undefined) state[key] = frame[key];
  }
  state.version = frame.version;
  return state;
}

// role — кто смотрит: 'tv', 'remote', 'admin' или 'play'. От неё зависит,
// что сервер вообще положит в кадр: телефону гостя правильные ответы не уходят.
export function start(role, ownerId) {
  if (source) source.close();
  state = null;

  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (ownerId) params.set('owner', ownerId);
  const query = params.toString();

  source = new EventSource('/api/events' + (query ? '?' + query : ''));
  source.onopen = () => onStatusCb(true);
  source.onerror = () => onStatusCb(false);
  source.onmessage = (e) => {
    try {
      const frame = JSON.parse(e.data);
      if (typeof frame.now === 'number') skew = frame.now - Date.now();
      onStateCb(merge(frame));
      onStatusCb(true);
    } catch (err) {
      // битый кадр — просто ждём следующий
    }
  };

  // Страховка: если браузер усыпил вкладку и поток умер молча, переподключаемся.
  if (!watchdog) {
    watchdog = setInterval(() => {
      if (source && source.readyState === 2) start(role, ownerId);
    }, 15000);
  }
}

export function fetchState() {
  return fetch('/api/state').then((r) => r.json());
}
