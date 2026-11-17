// Кооперативный клиент SKYFALL.
//
// Основной транспорт — прямой WebRTC DataChannel между игроками (P2P).
// Cloudflare Worker (или локальный server.js) используется только как
// сигнальный сервер: обменять SDP и отпустить игроков.
//
// WebSocket-релей оставлен как резервный путь: он включается, если сигнальный
// API недоступен или если адрес открыт с ?net=ws.
import { RtcLink } from './rtc.js';

const CHUNK = 48000;

function wantsWs() {
  try {
    const v = new URLSearchParams(location.search).get('net');
    return v === 'ws';
  } catch (e) {
    return false;
  }
}

export class Net {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.link = null;
    this.role = null;
    this.code = null;
    this.peer = false;
    this.connected = false;
    this.attempting = false;
    this.transport = null;
    this._timer = null;
    this._chunkId = 0;
    this._chunks = new Map();
    this._pending = null;
  }

  get url() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  /* ================= лобби ================= */

  hostRoom() {
    this._pending = { kind: 'host' };
    if (wantsWs()) { this.hostWs(); return; }
    this.transport = 'p2p';
    this.attempting = true;
    this.link = new RtcLink(this.handlers());
    this.link.host().catch((e) => this.signalingFailed(e));
  }

  joinRoom(code) {
    const clean = String(code || '').trim().toUpperCase();
    this._pending = { kind: 'join', code: clean };
    if (wantsWs()) { this.joinWs(clean); return; }
    this.transport = 'p2p';
    this.attempting = true;
    this.link = new RtcLink(this.handlers());
    this.link.join(clean).catch((e) => this.signalingFailed(e));
  }

  handlers() {
    return {
      onHosted: (code) => {
        this.role = 'host';
        this.code = code;
        this.connected = true;
        this.attempting = false;
        this.game.onHosted(code);
      },
      onJoined: (code) => {
        this.role = 'guest';
        this.code = code;
        this.connected = true;
        this.attempting = false;
        this.game.onJoined(code);
      },
      onStatus: (text) => this.status(text),
      onOpen: () => {
        this.peer = true;
        if (this.role === 'host') {
          this.status('Прямое соединение установлено. Можно начинать.');
          this.game.onPeerJoined('guest');
        } else {
          this.status('Прямое соединение установлено. Ждём старта хозяина…');
        }
      },
      onPeerLost: () => {
        this.peer = false;
        this.game.onPeerLeft({ hostLeft: this.role === 'guest' });
      },
      onRoomClosed: () => {
        this.peer = false;
        this.game.onPeerLeft({ hostLeft: true });
      },
      onError: (msg) => this.game.onNetError(msg),
      onMessage: (text) => this.onText(text),
    };
  }

  status(text, err = false) {
    const id = this.role === 'guest' ? 'join-status' : 'host-status';
    this.game.setCoopStatus(id, text, err ? 'err' : '');
  }

  signalingFailed(e) {
    this.attempting = false;
    if (e && e.code === 'no-signal') {
      const pending = this._pending || { kind: 'host' };
      this.link?.close();
      this.link = null;
      this.status('Сигнальный сервер недоступен. Пробуем WebSocket…');
      if (pending.kind === 'join') this.joinWs(pending.code);
      else this.hostWs();
      return;
    }
    this.transport = null;
    let msg = (e && e.message) || 'Не удалось открыть комнату';
    if (e && e.status === 404) msg = 'Комната не найдена. Проверьте код.';
    if (e && e.status === 410) msg = 'Комната уже закрыта.';
    this.game.onNetError(msg);
  }

  /* ================= сообщения ================= */

  dispatch(msg) {
    switch (msg.t) {
      case 'hosted':
        this.role = 'host';
        this.code = msg.code;
        this.game.onHosted(msg.code);
        break;
      case 'joined':
        this.role = 'guest';
        this.code = msg.code;
        this.game.onJoined(msg.code);
        break;
      case 'peer':
        this.peer = true;
        this.game.onPeerJoined(msg.role);
        break;
      case 'peerLeft':
        this.peer = false;
        this.game.onPeerLeft(msg);
        break;
      case 'error':
        this.game.onNetError(msg.msg || 'Ошибка соединения');
        break;
      default:
        this.game.onNetMessage(msg);
    }
  }

  onText(text) {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === '__p') { this.onChunk(msg); return; }
    this.dispatch(msg);
  }

  // Крупные пакеты (welcome с правками мира) режем на куски: у SCTP есть
  // ограничение на размер одного сообщения.
  onChunk(m) {
    if (!m.id || typeof m.i !== 'number' || typeof m.n !== 'number') return;
    let buf = this._chunks.get(m.id);
    if (!buf) {
      buf = { parts: new Array(m.n), got: 0, size: 0 };
      this._chunks.set(m.id, buf);
    }
    if (buf.parts[m.i] === undefined) {
      buf.parts[m.i] = m.d || '';
      buf.got++;
      buf.size += buf.parts[m.i].length;
    }
    if (buf.size > 8 * 1024 * 1024) { this._chunks.delete(m.id); return; }
    if (buf.got < m.n) return;
    this._chunks.delete(m.id);
    this.onText(buf.parts.join(''));
  }

  send(msg) {
    if (!msg) return false;
    const text = JSON.stringify(msg);
    const fast = msg.t === 'pos';

    if (this.transport === 'p2p' && this.link) {
      if (text.length <= CHUNK) return this.link.send(text, fast);
      if (fast) return false;
      const id = (++this._chunkId).toString(36) + Date.now().toString(36).slice(-4);
      const total = Math.ceil(text.length / CHUNK);
      for (let i = 0; i < total; i++) {
        const ok = this.link.send(JSON.stringify({
          t: '__p', id, i, n: total, d: text.slice(i * CHUNK, (i + 1) * CHUNK),
        }), false);
        if (!ok) return false;
      }
      return true;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(text); return true; } catch (e) { return false; }
    }
    return false;
  }

  /* ================= WebSocket-релей (резерв) ================= */

  connectWs() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.onWsReady();
      return;
    }
    this.attempting = true;
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this.attempting = false;
      this.game.onNetError('Не удалось открыть соединение');
      return;
    }
    this.ws = ws;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (!this.connected) {
        this.attempting = false;
        try { ws.close(); } catch (e) {}
        this.game.onNetError('Сервер не отвечает. Для онлайна задеплойте Cloudflare Worker, для локальной игры запустите start.bat.');
      }
    }, 8000);

    ws.onopen = () => {
      this.connected = true;
      this.attempting = false;
      clearTimeout(this._timer);
      this.game.onNetOpen();
      this.onWsReady();
    };
    ws.onmessage = (ev) => this.onText(ev.data);
    ws.onclose = () => {
      const wasConnected = this.connected;
      this.connected = false;
      this.peer = false;
      this.attempting = false;
      clearTimeout(this._timer);
      if (wasConnected) this.game.onNetClose();
    };
    ws.onerror = () => {
      if (!this.connected) {
        this.attempting = false;
        this.game.onNetError('Нет связи с сигнальным сервером. Для онлайна нужен Worker, для локальной игры — start.bat.');
      }
    };
  }

  onWsReady() {
    if (this.pendingHost) { this.pendingHost = false; this.send({ t: 'host' }); }
    if (this.pendingJoin) {
      const code = this.pendingJoin;
      this.pendingJoin = null;
      this.send({ t: 'join', code });
    }
  }

  hostWs() {
    this.transport = 'ws';
    this.pendingHost = true;
    this.connectWs();
  }

  joinWs(code) {
    this.transport = 'ws';
    this.pendingJoin = code;
    this.connectWs();
  }

  /* ================= завершение ================= */

  close() {
    clearTimeout(this._timer);
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    this.ws = null;
    if (this.link) {
      this.link.close();
      this.link = null;
    }
    this.pendingHost = false;
    this.pendingJoin = null;
    this._pending = null;
    this._chunks.clear();
    this.role = null;
    this.code = null;
    this.peer = false;
    this.connected = false;
    this.attempting = false;
    this.transport = null;
  }
}
