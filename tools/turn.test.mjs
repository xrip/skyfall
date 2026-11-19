import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../worker/index.js';
import { withTurn } from '../worker/turn.js';
import { iceServers, RtcLink } from '../src/rtc.js';

const env = {
  TURN_SECRET: 'test-only-shared-secret',
  TURN_URLS: 'turn:example.com:3478?transport=udp, turn:example.com:3478?transport=tcp',
};

test('temporary credentials match coturn HMAC and do not expose the secret', async () => {
  const before = Math.floor(Date.now() / 1000);
  const response = await withTurn(Response.json({ code: 'ABCD', token: 'host' }), env);
  const room = await response.json();
  const expiry = Number(room.turn.username.split(':')[0]);
  assert.ok(expiry >= before + 86400 && expiry <= Math.floor(Date.now() / 1000) + 86400);
  assert.equal(room.turn.credential, createHmac('sha1', env.TURN_SECRET).update(room.turn.username).digest('base64'));
  assert.deepEqual(room.turn.urls, env.TURN_URLS.split(',').map((url) => url.trim()));
  assert.equal(room.token, 'host');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!JSON.stringify(room).includes(env.TURN_SECRET));
});

test('failed requests and deployments without TURN keep their original response', async () => {
  const denied = Response.json({ error: 'closed' }, { status: 410 });
  assert.equal(await withTurn(denied, env), denied);
  const response = Response.json({ code: 'ABCD' });
  assert.equal(await withTurn(response, {}), response);
  assert.equal(await withTurn(response, { TURN_URLS: env.TURN_URLS }), response);
});

test('create and join receive credentials, poll does not', async () => {
  const bindings = {
    ...env,
    ROOMS: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => Response.json({ code: 'ABCD', token: 'player' }) }),
    },
  };
  const host = await (await worker.fetch(new Request('https://game/api/rooms', { method: 'POST' }), bindings)).json();
  const guest = await (await worker.fetch(new Request('https://game/api/rooms/ABCD/join', { method: 'POST' }), bindings)).json();
  const poll = await (await worker.fetch(new Request('https://game/api/rooms/ABCD/poll'), bindings)).json();
  assert.ok(host.turn && guest.turn);
  assert.notEqual(host.turn.username, guest.turn.username);
  assert.equal(poll.turn, undefined);
});

test('client uses room TURN, permits manual override, and clears old room credentials', () => {
  const previous = globalThis.localStorage;
  let saved = null;
  globalThis.localStorage = { getItem: () => saved };
  try {
    const automatic = { urls: ['turn:example.com'], username: 'temp', credential: 'temp-password' };
    const link = new RtcLink();
    link.apply({ code: 'ABCD', token: 'host', turn: automatic }, 'host');
    assert.deepEqual(iceServers(link.turn)[1], automatic);
    saved = JSON.stringify({ urls: 'turn:manual.example.com', username: 'manual', credential: 'password' });
    assert.equal(iceServers(link.turn)[1].username, 'manual');
    saved = null;
    link.apply({ code: 'EFGH', token: 'host2' }, 'host');
    assert.equal(link.turn, null);
    assert.equal(iceServers(link.turn).length, 1);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test('Pages preflight succeeds without creating or joining a room', async () => {
  for (const path of ['/api/rooms', '/api/rooms/ABCD/join', '/api/rooms/ABCD/signal']) {
    const response = await worker.fetch(new Request('https://game' + path, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://xrip.github.io',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    }), {});
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
    assert.match(response.headers.get('access-control-allow-headers'), /content-type/i);
  }
});

test('Pages uses the production API while local development keeps the local API', async () => {
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async (path) => {
    paths.push(path);
    return Response.json({ code: 'ABCD', token: 'test-player' });
  };
  try {
    for (const hostname of ['xrip.github.io', 'localhost', 'skyfall.akimus.ru', 'skyfall.xrip.workers.dev']) {
      globalThis.location = { hostname };
      const { RtcLink: Link } = await import('../src/rtc.js?host-test=' + hostname);
      const link = new Link();
      link.startPoll = () => {};
      await link.host();
      await link.join('ABCD');
      const base = hostname === 'localhost' ? '' : 'https://api.skyfall.akimus.ru';
      assert.equal(paths.at(-2), base + '/api/rooms');
      assert.equal(paths.at(-1), base + '/api/rooms/ABCD/join');
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});
