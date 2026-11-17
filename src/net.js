// WebSocket co-op client. The server is a dumb relay; the host is authoritative.
export class Net {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.role = null;
    this.code = null;
    this.peer = false;
    this.connected = false;
    this.attempting = false;
    this._timer = null;
  }

  get url() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
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
        this.game.onNetError('Сервер не отвечает. Запустите игру через start.bat.');
      }
    }, 8000);

    ws.onopen = () => {
      this.connected = true;
      this.attempting = false;
      clearTimeout(this._timer);
      this.game.onNetOpen();
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      this.dispatch(msg);
    };
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
        this.game.onNetError('Нет связи с сервером. Запустите start.bat и обновите страницу.');
      }
    };
  }

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

  send(msg) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try { this.ws.send(JSON.stringify(msg)); return true; } catch (e) { return false; }
  }

  hostRoom() {
    this.connect();
    const tryHost = () => {
      if (this.connected) this.send({ t: 'host' });
      else setTimeout(tryHost, 120);
    };
    tryHost();
  }

  joinRoom(code) {
    this.connect();
    const tryJoin = () => {
      if (this.connected) this.send({ t: 'join', code });
      else if (this.attempting) setTimeout(tryJoin, 120);
    };
    tryJoin();
  }

  close() {
    clearTimeout(this._timer);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.send({ t: 'leave' }); } catch (e) {}
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    this.ws = null;
    this.role = null;
    this.code = null;
    this.peer = false;
    this.connected = false;
  }
}
