// Cloudflare Worker SKYFALL.
//
//   * раздаёт статику из ./public (assets binding ASSETS);
//   * держит сигнальный API /api/rooms* на Durable Object.
//
// Игровой трафик через Worker НЕ идёт: после обмена SDP игроки соединяются
// напрямую по WebRTC. На бесплатном плане это десятки запросов на комнату.
import { json } from './json.js';
import { withTurn } from './turn.js';

export { Room } from './room.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

function roomStub(env, code) {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

async function createRoom(env) {
  for (let i = 0; i < 12; i++) {
    const code = randomCode();
    const res = await roomStub(env, code).fetch('https://room/create', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (res.status === 200) return withTurn(res, env);
  }
  return json({ error: 'Не удалось создать комнату' }, 503);
}

async function relay(env, code, action, request, search) {
  const target = new URL('https://room/' + action);
  target.search = search;
  const init = { method: request.method };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
    init.headers = { 'Content-Type': 'application/json' };
  }
  const response = await roomStub(env, code).fetch(target.toString(), init);
  return action === 'join' ? withTurn(response, env) : response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/') && request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (path === '/api/rooms') {
      if (request.method !== 'POST') return json({ error: 'Только POST' }, 405);
      return createRoom(env);
    }

    const m = path.match(/^\/api\/rooms\/([A-Za-z0-9]{2,8})\/(join|poll|signal|leave)$/);
    if (m) return relay(env, m[1].toUpperCase(), m[2], request, url.search);

    if (path.startsWith('/api/')) return json({ error: 'Неизвестный запрос' }, 404);

    return env.ASSETS.fetch(request);
  },
};
