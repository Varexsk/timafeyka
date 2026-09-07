'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { store } = require('./store');
const { applyCommand } = require('./commands');
const types = require('./types');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const MEDIA = path.join(ROOT, 'media');
const PORT = Number(process.env.PORT) || 1717;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const PHOTO_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v'];
const AUDIO_EXT = ['.mp3', '.m4a', '.ogg', '.wav'];

// ——— SSE ———

const clients = new Set();

function broadcast() {
  const payload = 'data: ' + JSON.stringify(store.snapshot()) + '\n\n';
  for (const res of clients) {
    try { res.write(payload); } catch (e) { clients.delete(res); }
  }
}

// ——— вспомогательное ———

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too big')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeJoin(base, rel) {
  const target = path.resolve(base, '.' + path.sep + rel.replace(/^[\\/]+/, ''));
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

function serveFile(req, res, file) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { send(res, 404, 'Не найдено'); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    // Range нужен, чтобы видео перематывалось в Chrome
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (start < stat.size) {
          res.writeHead(206, {
            'Content-Type': type,
            'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1
          });
          fs.createReadStream(file, { start, end }).pipe(res);
          return;
        }
      }
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
}

function kindOf(ext) {
  if (PHOTO_EXT.includes(ext)) return 'photo';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  return 'other';
}

function listMedia() {
  const out = [];
  const walk = (dir, prefix) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) { walk(path.join(dir, e.name), prefix + e.name + '/'); continue; }
      const ext = path.extname(e.name).toLowerCase();
      const kind = kindOf(ext);
      if (kind === 'other') continue;
      let size = 0;
      try { size = fs.statSync(path.join(dir, e.name)).size; } catch (err) { size = 0; }
      out.push({ name: prefix + e.name, path: 'media/' + prefix + e.name, kind, size });
    }
  };
  walk(MEDIA, '');
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function localAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      out.push(net.address);
    }
  }
  // 192.168.* обычно и есть домашний wi-fi — ставим его первым
  return out.sort((a, b) => (b.startsWith('192.168.') ? 1 : 0) - (a.startsWith('192.168.') ? 1 : 0));
}

// ——— маршруты ———

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/state') { sendJson(res, 200, store.snapshot()); return; }

  if (pathname === '/api/net') {
    sendJson(res, 200, { port: PORT, addresses: localAddresses() });
    return;
  }

  if (pathname === '/api/media') { sendJson(res, 200, { files: listMedia() }); return; }

  // Список форматов конкурсов: только сервер умеет читать папку types/.
  if (pathname === '/api/types') { sendJson(res, 200, { types: types.list() }); return; }

  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 1000\n\n');
    res.write('data: ' + JSON.stringify(store.snapshot()) + '\n\n');
    clients.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { /* ignore */ } }, 20000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }

  if (pathname === '/api/command' && req.method === 'POST') {
    let body;
    try { body = JSON.parse((await readBody(req, 4 * 1024 * 1024)).toString('utf8')); } catch (e) {
      sendJson(res, 400, { ok: false, error: 'Плохой JSON' });
      return;
    }
    const result = applyCommand(body.type, body.payload);
    if (result.ok) broadcast();
    sendJson(res, result.ok ? 200 : 400, Object.assign({ version: store.version }, result));
    return;
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    const raw = url.searchParams.get('name') || 'file';
    const clean = raw.replace(/[^\w.\- А-Яа-яЁё]+/g, '_').replace(/^\.+/, '').slice(-80) || 'file';
    const target = safeJoin(MEDIA, clean);
    if (!target) { sendJson(res, 400, { ok: false, error: 'Плохое имя файла' }); return; }
    let buf;
    try { buf = await readBody(req, 1024 * 1024 * 1024); } catch (e) {
      sendJson(res, 413, { ok: false, error: 'Файл больше 1 ГБ' });
      return;
    }
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buf);
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
      return;
    }
    sendJson(res, 200, { ok: true, path: 'media/' + clean });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, 'Только GET'); return; }

  if (pathname.startsWith('/media/')) {
    const file = safeJoin(MEDIA, pathname.slice('/media/'.length));
    if (!file) { send(res, 403, 'Нельзя'); return; }
    serveFile(req, res, file);
    return;
  }

  // Серверная половина формата на телефон гостя не отдаётся.
  if (/\.server\.mjs$/.test(pathname) || /(^|\/)package\.json$/.test(pathname)) {
    send(res, 404, 'Не найдено');
    return;
  }

  const pages = { '/': 'index.html', '/remote': 'remote.html', '/admin': 'admin.html' };
  if (pages[pathname]) { serveFile(req, res, path.join(PUBLIC, pages[pathname])); return; }

  const file = safeJoin(PUBLIC, pathname);
  if (!file) { send(res, 403, 'Нельзя'); return; }
  serveFile(req, res, file);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('');
    console.log('  Порт ' + PORT + ' уже занят — похоже, цирк уже запущен в другом окне.');
    console.log('  Открой http://localhost:' + PORT + '/ или закрой то окно и запусти заново.');
    console.log('');
  } else {
    console.log('  Не смог запустить сервер: ' + err.message);
  }
  process.exit(1);
});

function banner() {
  const addrs = localAddresses();
  const remote = addrs.length ? 'http://' + addrs[0] + ':' + PORT + '/remote' : 'нет сети';
  console.log('');
  console.log('  🎪  ЦИРК ТИМОШИ запущен');
  console.log('  ─────────────────────────────────────────────');
  console.log('  Экран телевизора :  http://localhost:' + PORT + '/');
  console.log('  Пульт с телефона :  ' + remote);
  console.log('  Кабинет ведущего :  http://localhost:' + PORT + '/admin');
  console.log('  ─────────────────────────────────────────────');
  console.log('  Чтобы остановить — закрой это окно.');
  console.log('');
}

// Форматы конкурсов читаются до старта: сервер должен знать, как считать баллы.
types.load()
  .then(() => {
    store.load();
    server.listen(PORT, '0.0.0.0', banner);
  })
  .catch((err) => {
    console.log('');
    console.log('  Не смог прочитать форматы конкурсов: ' + err.message);
    console.log('');
    process.exit(1);
  });

process.on('SIGINT', () => { store.flush(); process.exit(0); });
process.on('SIGTERM', () => { store.flush(); process.exit(0); });
