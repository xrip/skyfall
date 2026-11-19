import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';

test('VPS server supports cross-origin rooms, TURN credentials, and authenticated signaling', async (t) => {
  const secret = 'test-only-server-secret';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', NO_OPEN: '1', TURN_SECRET: secret, TURN_URLS: 'turn:test.example:3478' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server start timeout')), 10000);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.on('error', reject);
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error('Server exited: ' + code)); });
  });
  const request = (path, method = 'GET', body) => fetch(`http://127.0.0.1:${port}${path}`, {
    method, headers: { Origin: 'https://xrip.github.io', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const preflight = await request('/api/rooms', 'OPTIONS');
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  const created = await request('/api/rooms', 'POST', {});
  const host = await created.json();
  assert.equal(created.status, 200);
  assert.equal(created.headers.get('cache-control'), 'no-store');
  assert.equal(host.turn.credential, createHmac('sha1', secret).update(host.turn.username).digest('base64'));
  assert.equal((await request(`/api/rooms/${host.code}/poll`)).status, 403);
  const guest = await (await request(`/api/rooms/${host.code}/join`, 'POST', {})).json();
  assert.notEqual(guest.token, host.token);
  assert.notEqual(guest.turn.username, host.turn.username);
  assert.equal((await request(`/api/rooms/${host.code}/signal?token=wrong`, 'POST', {})).status, 403);
  assert.equal((await request(`/api/rooms/${host.code}/signal?token=${guest.token}`, 'POST', { data: { k: 'answer', test: true } })).status, 200);
  const poll = await (await request(`/api/rooms/${host.code}/poll?token=${host.token}`)).json();
  assert.deepEqual(poll.msgs[0].data, { k: 'answer', test: true });
  assert.equal(poll.turn, undefined);
  assert.equal((await request(`/api/rooms/${host.code}/leave?token=${host.token}`, 'POST', {})).status, 200);
  assert.equal((await (await request(`/api/rooms/${host.code}/poll?token=${guest.token}`)).json()).closed, true);
});
