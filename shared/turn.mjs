// Coturn REST credentials expire after one day; the shared secret stays on the server.
export async function createTurn(secret, urls, cryptoApi = globalThis.crypto) {
  const username = `${Math.floor(Date.now() / 1000) + 86400}:${cryptoApi.randomUUID()}`;
  const encoder = new TextEncoder();
  const key = await cryptoApi.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const signature = await cryptoApi.subtle.sign('HMAC', key, encoder.encode(username));
  return {
    urls: urls.split(',').map((url) => url.trim()).filter(Boolean),
    username,
    credential: btoa(String.fromCharCode(...new Uint8Array(signature))),
  };
}
