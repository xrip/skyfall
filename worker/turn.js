import { json } from './json.js';

// Coturn REST credentials expire after one day. The shared secret stays on the server.
export async function withTurn(response, env) {
  if (!response.ok || !env.TURN_SECRET || !env.TURN_URLS) return response;

  const room = await response.json();
  const username = `${Math.floor(Date.now() / 1000) + 86400}:${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(env.TURN_SECRET),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(username));
  room.turn = {
    urls: env.TURN_URLS.split(',').map((url) => url.trim()).filter(Boolean),
    username,
    credential: btoa(String.fromCharCode(...new Uint8Array(signature))),
  };
  return json(room, response.status);
}
