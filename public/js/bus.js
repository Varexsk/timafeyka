// Связь с сервером: поток состояния (SSE) в одну сторону, команды (POST) в другую.

let onStateCb = () => {};
let onStatusCb = () => {};
let source = null;

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

export function start() {
  if (source) source.close();
  source = new EventSource('/api/events');
  source.onopen = () => onStatusCb(true);
  source.onerror = () => onStatusCb(false);
  source.onmessage = (e) => {
    try {
      onStateCb(JSON.parse(e.data));
      onStatusCb(true);
    } catch (err) {
      // битый кадр — просто ждём следующий
    }
  };
  // Страховка: если браузер усыпил вкладку и поток умер молча, раз в 15 секунд
  // дозапрашиваем состояние обычным запросом.
  setInterval(() => {
    if (source && source.readyState === 2) start();
  }, 15000);
}

export function fetchState() {
  return fetch('/api/state').then((r) => r.json());
}
