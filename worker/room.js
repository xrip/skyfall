// Durable Object: одна комната = один объект.
// Хранит только сигнальные данные (SDP). Игровой трафик сюда не попадает:
// после рукопожатия игроки общаются напрямую по WebRTC.
import { json } from './json.js';

const TTL = 20 * 60 * 1000;
const MAX_MSGS = 40;

export class Room {
  constructor(state) {
    this.state = state;
    this.data = null;
  }

  async load() {
    if (!this.data) this.data = (await this.state.storage.get('room')) || null;
    return this.data;
  }

  async save(room) {
    room.touched = Date.now();
    this.data = room;
    await this.state.storage.put('room', room);
    await this.state.storage.setAlarm(Date.now() + TTL);
  }

  async alarm() {
    const room = await this.load();
    if (!room) return;
    if (Date.now() - room.touched > TTL) {
      await this.state.storage.deleteAll();
      this.data = null;
      return;
    }
    await this.state.storage.setAlarm(room.touched + TTL);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.pathname.split('/').filter(Boolean)[0] || '';

    if (action === 'create') {
      const existing = await this.load();
      if (existing && !existing.closed) return json({ error: 'Код занят' }, 409);
      let body = {};
      try { body = await request.json(); } catch (e) { body = {}; }
      const room = {
        code: body.code || 'ROOM',
        host: crypto.randomUUID(),
        guest: null,
        session: 0,
        msgs: [],
        seq: 0,
        closed: false,
        touched: Date.now(),
      };
      await this.save(room);
      return json({ code: room.code, token: room.host, role: 'host', seq: 0, session: 0 });
    }

    const room = await this.load();
    if (!room) return json({ error: 'Комната не найдена' }, 404);

    if (action === 'join') {
      if (room.closed) return json({ error: 'Комната закрыта' }, 410);
      if (room.guest) return json({ error: 'В комнате уже двое' }, 409);
      room.guest = crypto.randomUUID();
      room.session++;
      room.msgs = [];
      await this.save(room);
      return json({ code: room.code, token: room.guest, role: 'guest', seq: room.seq, session: room.session });
    }

    const token = url.searchParams.get('token');
    if (token !== room.host && token !== room.guest) {
      return json({ error: 'Нет доступа к комнате' }, 403);
    }

    if (action === 'signal') {
      let body = {};
      try { body = await request.json(); } catch (e) { body = {}; }
      room.seq++;
      room.msgs.push({
        n: room.seq,
        from: token === room.host ? 'host' : 'guest',
        data: body && body.data !== undefined ? body.data : null,
      });
      if (room.msgs.length > MAX_MSGS) room.msgs.splice(0, room.msgs.length - MAX_MSGS);
      await this.save(room);
      return json({ ok: true, seq: room.seq });
    }

    if (action === 'poll') {
      const since = Number(url.searchParams.get('since')) || 0;
      const me = token === room.host ? 'host' : 'guest';
      return json({
        seq: room.seq,
        msgs: room.msgs.filter((m) => m.n > since && m.from !== me),
        session: room.session,
        guest: !!room.guest,
        closed: room.closed,
      });
    }

    if (action === 'leave') {
      if (token === room.host) {
        room.closed = true;
      } else {
        room.guest = null;
        room.msgs = [];
      }
      await this.save(room);
      return json({ ok: true });
    }

    return json({ error: 'Неизвестный запрос' }, 404);
  }
}
