// Zero-dependency static server for SKYFALL
// Run: node server.js  →  http://localhost:8080
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const turnModule = import('./shared/turn.mjs');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* ============================================================
   Signaling API for P2P co-op (same protocol as the Cloudflare Worker)
   ============================================================ */
const signals = new Map();
const SIGNAL_TTL = 20 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

async function withTurn(room) {
  if (!process.env.TURN_SECRET || !process.env.TURN_URLS) return room;
  const { createTurn } = await turnModule;
  return { ...room, turn: await createTurn(process.env.TURN_SECRET, process.env.TURN_URLS, crypto.webcrypto) };
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 256 * 1024) req.destroy();
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function handleApi(req, res, path, query) {
  if (path === '/api/rooms') {
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Только POST' }); return; }
    let code;
    do { code = newCode(); } while (signals.has(code));
    const room = {
      code,
      host: crypto.randomBytes(16).toString('hex'),
      guest: null,
      session: 0,
      msgs: [],
      seq: 0,
      closed: false,
      touched: Date.now(),
    };
    signals.set(code, room);
    sendJson(res, 200, await withTurn({ code, token: room.host, role: 'host', seq: 0, session: 0 }));
    return;
  }

  const m = path.match(/^\/api\/rooms\/([A-Za-z0-9]{2,8})\/(join|poll|signal|leave)$/);
  if (!m) { sendJson(res, 404, { error: 'Неизвестный запрос' }); return; }

  const code = m[1].toUpperCase();
  const action = m[2];
  const room = signals.get(code);
  if (!room) { sendJson(res, 404, { error: 'Комната не найдена' }); return; }
  room.touched = Date.now();

  if (action === 'join') {
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Только POST' }); return; }
    if (room.closed) { sendJson(res, 410, { error: 'Комната закрыта' }); return; }
    if (room.guest) { sendJson(res, 409, { error: 'В комнате уже двое' }); return; }
    room.guest = crypto.randomBytes(16).toString('hex');
    room.session++;
    room.msgs = [];
    sendJson(res, 200, await withTurn({ code, token: room.guest, role: 'guest', seq: room.seq, session: room.session }));
    return;
  }

  const token = query.get('token');
  if (!token || (token !== room.host && token !== room.guest)) {
    sendJson(res, 403, { error: 'Нет доступа к комнате' });
    return;
  }

  if (action === 'signal') {
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Только POST' }); return; }
    const body = await readJsonBody(req);
    room.seq++;
    room.msgs.push({
      n: room.seq,
      from: token === room.host ? 'host' : 'guest',
      data: body && body.data !== undefined ? body.data : null,
    });
    if (room.msgs.length > 40) room.msgs.splice(0, room.msgs.length - 40);
    sendJson(res, 200, { ok: true, seq: room.seq });
    return;
  }

  if (action === 'poll') {
    const since = Number(query.get('since')) || 0;
    const me = token === room.host ? 'host' : 'guest';
    sendJson(res, 200, {
      seq: room.seq,
      msgs: room.msgs.filter((msg) => msg.n > since && msg.from !== me),
      session: room.session,
      guest: !!room.guest,
      closed: room.closed,
    });
    return;
  }

  if (action === 'leave') {
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Только POST' }); return; }
    if (token === room.host) {
      room.closed = true;
      setTimeout(() => signals.delete(code), 30000);
    } else {
      room.guest = null;
      room.msgs = [];
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'Неизвестный запрос' });
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of signals) {
    if (now - room.touched > SIGNAL_TTL) signals.delete(code);
  }
}, 60000).unref();

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    const url = decodeURIComponent(parsed.pathname);
    if (url.startsWith('/api/')) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }
      await handleApi(req, res, url, parsed.searchParams);
      return;
    }
    let rel = url === '/' ? '/index.html' : url;
    rel = rel.replace(/\.\./g, '').replace(/\\/g, '/');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 — not found');
        return;
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(file).pipe(res);
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500');
  }
});

server.listen(PORT, HOST, () => {
  const port = server.address().port;
  console.log('');
  console.log('  SKYFALL — Небесный рубеж');
  console.log('  ---------------------------------------------');
  console.log(`  Локально:  http://localhost:${port}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  В сети:    http://${net.address}:${port}`);
      }
    }
  }
  console.log('  ---------------------------------------------');
  console.log('  Кооператив: P2P через WebRTC, сервер только для сигналинга.');
  console.log('  Ctrl+C — остановить сервер');
  console.log('');
  if (process.platform === 'win32' && !process.env.NO_OPEN) {
    try {
      require('child_process').exec(`start "" "http://localhost:${PORT}"`);
    } catch (e) { /* ignore */ }
  }
});

/* ============================================================
   Minimal WebSocket relay for co-op (zero dependencies)
   ============================================================ */
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const rooms = new Map();
const conns = new Set();

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  return 'X' + Date.now().toString(36).slice(-3).toUpperCase();
}

function wsSend(conn, obj) {
  if (!conn || !conn.socket || conn.socket.destroyed) return;
  const data = typeof obj === 'string' ? obj : JSON.stringify(obj);
  sendFrame(conn.socket, Buffer.from(data), 0x1);
}

function sendFrame(socket, payload, opcode = 0x1) {
  if (!socket || socket.destroyed) return;
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try { socket.write(Buffer.concat([header, payload])); } catch (e) { /* ignore */ }
}

function closeConn(conn) {
  if (!conn) return;
  const room = conn.room ? rooms.get(conn.room) : null;
  if (room) {
    const peer = room.host === conn ? room.guest : room.host;
    if (peer) {
      wsSend(peer, { t: 'peerLeft', hostLeft: room.host === conn });
      if (room.host === conn) {
        peer.room = null;
      } else {
        room.guest = null;
      }
    }
    if (room.host === conn) rooms.delete(room.code);
  }
  conn.room = null;
  conn.role = null;
  if (conn.ping) clearInterval(conn.ping);
  conns.delete(conn);
  try { conn.socket.destroy(); } catch (e) { /* ignore */ }
}

function onMessage(conn, text) {
  let msg;
  try { msg = JSON.parse(text); } catch (e) { return; }
  if (!msg || typeof msg !== 'object') return;

  if (msg.t === 'host') {
    if (conn.room) { wsSend(conn, { t: 'error', msg: 'Вы уже в комнате' }); return; }
    const code = randomCode();
    const room = { code, host: conn, guest: null };
    rooms.set(code, room);
    conn.room = code;
    conn.role = 'host';
    wsSend(conn, { t: 'hosted', code });
    return;
  }

  if (msg.t === 'join') {
    if (conn.room) { wsSend(conn, { t: 'error', msg: 'Вы уже в комнате' }); return; }
    const code = String(msg.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) { wsSend(conn, { t: 'error', msg: 'Комната не найдена' }); return; }
    if (room.guest) { wsSend(conn, { t: 'error', msg: 'В комнате уже двое' }); return; }
    if (room.host === conn) { wsSend(conn, { t: 'error', msg: 'Вы хозяин комнаты' }); return; }
    room.guest = conn;
    conn.room = code;
    conn.role = 'guest';
    wsSend(conn, { t: 'joined', code });
    wsSend(room.host, { t: 'peer', role: 'guest' });
    return;
  }

  if (msg.t === 'leave') { closeConn(conn); return; }

  // relay game messages to the other peer
  if (conn.room) {
    const room = rooms.get(conn.room);
    if (!room) return;
    const peer = room.host === conn ? room.guest : room.host;
    if (peer) wsSend(peer, msg);
  }
}

function pump(conn) {
  while (true) {
    const b = conn.buffer;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (b.length < 4) return;
      len = b.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (b.length < 10) return;
      const big = b.readBigUInt64BE(2);
      if (big > 2n ** 21n) { closeConn(conn); return; }
      len = Number(big); off = 10;
    }
    let mask = null;
    if (masked) {
      if (b.length < off + 4) return;
      mask = b.subarray(off, off + 4); off += 4;
    }
    if (len > 2 * 1024 * 1024) { closeConn(conn); return; }
    if (b.length < off + len) return;
    let payload = Buffer.from(b.subarray(off, off + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    conn.buffer = b.subarray(off + len);
    conn.alive = true;

    if (opcode === 0x8) { closeConn(conn); return; }
    if (opcode === 0x9) { sendFrame(conn.socket, payload, 0xA); continue; }
    if (opcode === 0xA) continue;
    if (opcode === 0x1 || opcode === 0x2) {
      onMessage(conn, payload.toString('utf8'));
    }
    if (!fin) { /* browser clients aren't expected to fragment control messages */ }
  }
}

server.on('upgrade', (req, socket) => {
  if (!req.url || !req.url.startsWith('/ws')) { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.setNoDelay(true);
  const conn = { socket, room: null, role: null, buffer: Buffer.alloc(0), alive: true };
  conns.add(conn);
  socket.on('data', (data) => {
    conn.alive = true;
    if (conn.buffer.length + data.length > 4 * 1024 * 1024) { closeConn(conn); return; }
    conn.buffer = Buffer.concat([conn.buffer, data]);
    pump(conn);
  });
  socket.on('close', () => closeConn(conn));
  socket.on('error', () => closeConn(conn));
  conn.ping = setInterval(() => {
    if (!conn.alive) { closeConn(conn); return; }
    conn.alive = false;
    sendFrame(socket, Buffer.alloc(0), 0x9);
  }, 25000);
});

