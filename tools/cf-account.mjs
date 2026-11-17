// Определяет Cloudflare account id по API-токену.
// В stdout печатается только id — его забирает GitHub Actions.
// Ошибки и подсказки уходят в stderr.
//
// Токен из шаблона «Edit Cloudflare Workers» содержит Account Settings Read
// и User Memberships Read, поэтому аккаунт находится автоматически.
const token = process.env.CLOUDFLARE_API_TOKEN;
const preferred = process.env.CLOUDFLARE_ACCOUNT_ID;

if (preferred) {
  console.log(preferred);
  process.exit(0);
}

if (!token) {
  console.error('CLOUDFLARE_API_TOKEN не задан.');
  process.exit(1);
}

async function get(path) {
  let res;
  try {
    res = await fetch('https://api.cloudflare.com/client/v4' + path, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    return { res: null, body: null, error: e.message };
  }
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  return { res, body };
}

function listOf(body) {
  return body && body.success !== false && Array.isArray(body.result) ? body.result : [];
}

let { res, body, error } = await get('/accounts?per_page=50');
let accounts = listOf(body);

if (!accounts.length) {
  // Резервный путь: список членств пользователя.
  const mem = await get('/memberships?per_page=50');
  const fromMemberships = listOf(mem.body).map((m) => m && m.account).filter(Boolean);
  if (fromMemberships.length) accounts = fromMemberships;
  if (!res) res = mem.res;
  if (!body) body = mem.body;
  if (!error) error = mem.error;
}

if (!accounts.length) {
  if (error) console.error('Не удалось связаться с api.cloudflare.com: ' + error);
  else {
    const details = body && Array.isArray(body.errors)
      ? body.errors.map((e) => e.message).filter(Boolean).join('; ')
      : '';
    console.error(`Cloudflare API ответил ${res ? res.status : '—'}${details ? ': ' + details : ''}`);
  }
  console.error('Нужен токен из шаблона «Edit Cloudflare Workers» (API Tokens → Create Token).');
  process.exit(1);
}

const seen = new Set();
accounts = accounts.filter((a) => a && a.id && !seen.has(a.id) && seen.add(a.id));

if (accounts.length > 1) {
  console.error('Токену доступно несколько аккаунтов:');
  for (const a of accounts) console.error(`  ${a.name} — ${a.id}`);
  console.error('Добавьте секрет CLOUDFLARE_ACCOUNT_ID с нужным id.');
  process.exit(1);
}

console.log(accounts[0].id);
