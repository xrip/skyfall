import { json } from './json.js';
import { createTurn } from '../shared/turn.mjs';

// Coturn REST credentials expire after one day. The shared secret stays on the server.
export async function withTurn(response, env) {
  if (!response.ok || !env.TURN_SECRET || !env.TURN_URLS) return response;

  const room = await response.json();
  room.turn = await createTurn(env.TURN_SECRET, env.TURN_URLS);
  return json(room, response.status);
}
