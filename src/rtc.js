// P2P транспорт SKYFALL: WebRTC DataChannel.
//
// Сигнальный сервер (Cloudflare Worker или локальный server.js) нужен только
// чтобы обменять SDP. Дальше весь игровой трафик идёт напрямую между игроками.
//
// Схема:
//   host:  POST /api/rooms                → { code, token }
//          POST /api/rooms/:code/signal   → offer
//          GET  /api/rooms/:code/poll     → answer
//   guest: POST /api/rooms/:code/join     → { token }
//          GET  /api/rooms/:code/poll     → offer
//          POST /api/rooms/:code/signal   → answer
//
// SDP отправляется один раз (non-trickle): ждём окончания сбора ICE-кандидатов
// и кладём всё в один пакет. Так сигналингу хватает нескольких запросов.
// Если прямой путь закрыт, браузер использует TURN из ответа создания/входа в комнату.

// All hosted builds share the direct VPS API; local development uses its own server.
export const API_ORIGIN = ['xrip.github.io', 'skyfall.akimus.ru', 'skyfall.xrip.workers.dev']
  .includes(globalThis.location?.hostname) ? 'https://api.skyfall.akimus.ru' : '';
const SIG = API_ORIGIN + '/api/rooms';
const STUN = [
  'stun:stun.cloudflare.com:3478',
  'stun:stun.l.google.com:19302',
];
const TURN_KEY = 'skyfall.turn';
const MAX_ATTEMPTS = 3;
const ICE_WAIT = 3500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class NoSignal extends Error {
  constructor(msg) {
    super(msg || 'Сигнальный сервер недоступен');
    this.code = 'no-signal';
  }
}

export function loadTurn() {
  try {
    const raw = JSON.parse(localStorage.getItem(TURN_KEY) || 'null');
    if (!raw || !raw.urls) return null;
    const urls = String(raw.urls).split(',').map((s) => s.trim()).filter(Boolean);
    if (!urls.length) return null;
    return {
      urls,
      username: raw.username || undefined,
      credential: raw.credential || undefined,
    };
  } catch (e) {
    return null;
  }
}

export function saveTurn(cfg) {
  try {
    if (!cfg || !cfg.urls) localStorage.removeItem(TURN_KEY);
    else {
      localStorage.setItem(TURN_KEY, JSON.stringify({
        urls: cfg.urls,
        username: cfg.username || '',
        credential: cfg.credential || '',
      }));
    }
  } catch (e) { /* приватный режим — просто не сохраняем */ }
}

export function iceServers(defaultTurn = null) {
  const list = [{ urls: STUN.slice() }];
  const turn = loadTurn() || defaultTurn;
  if (turn) list.push(turn);
  return list;
}

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (e) {
    throw new NoSignal();
  }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new NoSignal();
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Ошибка сервера (' + res.status + ')');
    err.status = res.status;
    throw err;
  }
  if (!data) throw new NoSignal();
  return data;
}

function gather(pc, ms) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener('icegatheringstatechange', check);
      pc.removeEventListener('icecandidate', onCand);
      resolve();
    };
    const check = () => { if (pc.iceGatheringState === 'complete') finish(); };
    const onCand = (e) => { if (!e.candidate) finish(); };
    pc.addEventListener('icegatheringstatechange', check);
    pc.addEventListener('icecandidate', onCand);
    setTimeout(finish, ms);
  });
}

export class RtcLink {
  constructor(handlers) {
    this.h = handlers || {};
    this.peers = new Map();
    this.peerId = null;
    this.playerId = null;
    this.code = null;
    this.token = null;
    this.turn = null;
    this.role = null;
    this.seq = 0;
    this.session = 0;
    this.attempt = 0;
    this.peerAttempt = 0;
    this.offerSession = -1;
    this.pc = null;
    this.dc = null;
    this.fast = null;
    this.open = false;
    this.dead = false;
    this.polling = false;
    this._retry = null;
  }

  /* ---------- создание и вход ---------- */

  async host() {
    const room = await api('POST', SIG, {});
    this.apply(room, 'host');
    this.h.onHosted?.(room.code);
    this.h.onStatus?.('Комната открыта. Ждём друга…');
    this.startPoll();
    return room.code;
  }

  async join(code) {
    const room = await api('POST', SIG + '/' + encodeURIComponent(code) + '/join', {});
    this.apply(room, 'guest');
    this.h.onJoined?.(room.code);
    this.h.onStatus?.('Комната найдена. Устанавливаем соединение…');
    this.startPoll();
    return room.code;
  }

  apply(room, role) {
    this.playerId = room.playerId ?? null;
    this.code = room.code;
    this.token = room.token;
    this.turn = room.turn || null;
    this.role = role;
    this.seq = Number(room.seq) || 0;
    this.session = Number(room.session) || 0;
  }

  /* ---------- опрос сигнального сервера ---------- */

  async startPoll() {
    if (this.polling) return;
    this.polling = true;
    let fails = 0;
    while (!this.dead) {
      let r = null;
      try {
        r = await api('GET', SIG + '/' + this.code + '/poll?token=' + encodeURIComponent(this.token) + '&since=' + this.seq);
        fails = 0;
      } catch (e) {
        if (this.dead) break;
        if (e.status === 404 || e.status === 410) { this.roomGone(); return; }
        fails++;
        if (fails === 3) this.h.onStatus?.('Сигнальный сервер не отвечает. Пробуем ещё…');
        await sleep(Math.min(400 * fails, 3000));
        continue;
      }
      if (this.dead) break;
      if (typeof r.seq === 'number') this.seq = r.seq;
      if (this.role === 'host' && Array.isArray(r.players)) this.syncPeers(r.players);
      if (Array.isArray(r.msgs)) for (const m of r.msgs) this.onSignal(m);
      if (r.closed) { this.roomGone(); return; }
      if (this.role === 'host' && !Array.isArray(r.players) && Number(r.session) > this.session) {
        this.session = Number(r.session);
        this.negotiate();
      }
      await sleep(this.open && this.role !== 'host' ? 6000 : 500);
    }
  }

  syncPeers(ids) {
    for (const [id, peer] of this.peers) {
      if (ids.includes(id)) continue;
      const wasOpen = peer.open;
      peer.finish();
      this.peers.delete(id);
      if (wasOpen) this.h.onPeerLost?.(id);
    }
    for (const id of ids) {
      if (this.peers.has(id)) continue;
      const peer = new RtcLink({
        voice: this.h.voice,
        onOpen: () => this.h.onOpen?.(id),
        onPeerLost: () => this.h.onPeerLost?.(id),
        onMessage: (text) => this.h.onMessage?.(text, id),
      });
      peer.apply(this, 'host');
      peer.peerId = id;
      this.peers.set(id, peer);
      peer.negotiate();
    }
  }

  onSignal(msg) {
    if (this.role === 'host' && this.peerId === null && this.peers.has(msg?.from)) {
      this.peers.get(msg.from).onSignal(msg);
      return;
    }
    const d = msg && msg.data;
    if (!d || typeof d !== 'object') return;
    if (d.k === 'offer' && this.role === 'guest') this.acceptOffer(d).catch(() => {});
    else if (d.k === 'answer' && this.role === 'host') this.acceptAnswer(d).catch(() => {});
  }

  signal(data) {
    if (this.dead || !this.code || !this.token) return Promise.resolve();
    return api('POST', SIG + '/' + this.code + '/signal?token=' + encodeURIComponent(this.token), { data, to: this.peerId })
      .catch(() => { /* следующая попытка всё равно будет */ });
  }

  /* ---------- установка соединения ---------- */

  async negotiate() {
    if (this.dead) return;
    this.offerSession = this.session;
    this.attempt++;
    const attempt = this.attempt;
    clearTimeout(this._retry);
    this.closePeer(false);
    this.h.onStatus?.('Друг найден. Устанавливаем соединение…');

    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: iceServers(this.turn) });
    } catch (e) {
      this.h.onError?.('Браузер не поддерживает WebRTC');
      return;
    }
    this.pc = pc;
    this.attach(pc.createDataChannel('game', { ordered: true }), false);
    this.attach(pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }), true);
    this.watch(pc);

    try {
      await this.attachVoice(pc, true);
      await pc.setLocalDescription(await pc.createOffer());
      await gather(pc, ICE_WAIT);
      if (this.dead || this.pc !== pc) return;
      await this.signal({ k: 'offer', sdp: pc.localDescription, attempt });
    } catch (e) {
      this.h.onError?.('Не удалось создать предложение соединения');
      return;
    }

    this._retry = setTimeout(() => {
      if (this.dead || this.open || this.attempt !== attempt) return;
      if (this.session !== this.offerSession) return;
      if (this.attempt >= MAX_ATTEMPTS) {
        this.h.onError?.('Соединение не установилось. Проверьте сеть или укажите другой TURN-сервер.');
        return;
      }
      this.negotiate();
    }, 6000);
  }

  async acceptOffer(d) {
    if (this.dead) return;
    const attempt = Number(d.attempt) || 0;
    if (this.pc && attempt <= this.peerAttempt) return;
    this.peerAttempt = attempt;
    this.closePeer(false);

    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: iceServers(this.turn) });
    } catch (e) {
      this.h.onError?.('Браузер не поддерживает WebRTC');
      return;
    }
    this.pc = pc;
    pc.ondatachannel = (ev) => this.attach(ev.channel, ev.channel.label === 'fast');
    this.watch(pc);

    try {
      await pc.setRemoteDescription(d.sdp);
      if (this.dead || this.pc !== pc) return;
      await this.attachVoice(pc, false);
      await pc.setLocalDescription(await pc.createAnswer());
      await gather(pc, ICE_WAIT);
      if (this.dead || this.pc !== pc) return;
      await this.signal({ k: 'answer', sdp: pc.localDescription });
    } catch (e) {
      this.h.onError?.('Не удалось принять соединение');
    }
  }

  async acceptAnswer(d) {
    if (this.dead || !this.pc) return;
    if (this.pc.signalingState !== 'have-local-offer') return;
    try { await this.pc.setRemoteDescription(d.sdp); } catch (e) { /* устаревший ответ */ }
  }

  attach(ch, isFast) {
    if (isFast) this.fast = ch;
    else this.dc = ch;
    ch.onopen = () => { if (!isFast) this.markOpen(); };
    ch.onclose = () => { if (!isFast) this.peerLost(); };
    ch.onerror = () => { if (!isFast) this.peerLost(); };
    ch.onmessage = (ev) => {
      if (typeof ev.data === 'string') this.h.onMessage?.(ev.data);
    };
  }

  async attachVoice(pc, host) {
    const voice = this.h.voice;
    if (!voice) return;
    try {
      await voice.attach(pc, host);
    } catch {
      voice.detach(pc);
    }
  }

  watch(pc) {
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      if (pc.connectionState === 'failed') this.peerLost();
      else if (pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (this.pc === pc && pc.connectionState === 'disconnected') this.peerLost();
        }, 4000);
      }
    };
  }

  markOpen() {
    if (this.open) return;
    this.open = true;
    clearTimeout(this._retry);
    this.h.onOpen?.();
  }

  /* ---------- передача ---------- */

  send(text, fast = false, target = null) {
    if (this.peers.size) {
      if (target !== null) return this.peers.get(target)?.send(text, fast) ?? false;
      let sent = false;
      for (const peer of this.peers.values()) sent = peer.send(text, fast) || sent;
      return sent;
    }
    let ch = null;
    if (fast && this.fast && this.fast.readyState === 'open') ch = this.fast;
    else if (this.dc && this.dc.readyState === 'open') ch = this.dc;
    if (!ch) return false;
    if (fast && ch.bufferedAmount > 256 * 1024) return false;
    try { ch.send(text); return true; } catch (e) { return false; }
  }

  /* ---------- завершение ---------- */

  closePeer(notify) {
    clearTimeout(this._retry);
    const wasOpen = this.open;
    const dc = this.dc;
    const fast = this.fast;
    const pc = this.pc;
    this.dc = null;
    this.fast = null;
    this.pc = null;
    this.open = false;
    for (const ch of [dc, fast]) {
      if (!ch) continue;
      ch.onopen = ch.onclose = ch.onerror = ch.onmessage = null;
      try { ch.close(); } catch (e) { /* уже закрыт */ }
    }
    if (pc) {
      this.h.voice?.detach(pc);
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch (e) { /* уже закрыт */ }
    }
    if (notify && (wasOpen || this.role === 'guest')) this.h.onPeerLost?.();
  }

  peerLost() {
    if (this.dead) return;
    this.closePeer(true);
  }

  roomGone() {
    if (this.dead) return;
    this.dead = true;
    this.closePeer(false);
    this.h.onRoomClosed?.();
  }

  finish() {
    for (const peer of this.peers.values()) peer.finish();
    this.peers.clear();
    this.dead = true;
    this.closePeer(false);
  }

  close() {
    if (this.dead) return;
    this.dead = true;
    clearTimeout(this._retry);
    for (const peer of this.peers.values()) peer.finish();
    this.peers.clear();
    const code = this.code;
    const token = this.token;
    this.closePeer(false);
    if (code && token) {
      api('POST', SIG + '/' + code + '/leave?token=' + encodeURIComponent(token), {}).catch(() => {});
    }
    this.code = null;
    this.token = null;
  }
}
