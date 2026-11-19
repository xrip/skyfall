# Direct signaling API

Production clients on GitHub Pages, `skyfall.akimus.ru`, and
`skyfall.xrip.workers.dev` use `https://api.skyfall.akimus.ru/api/rooms`.
The WebSocket fallback uses `wss://api.skyfall.akimus.ru/ws`.
Local development still uses the local server.

## Server and traffic

- Server: `62.84.172.208`, DNS-only A records for both `api.skyfall.akimus.ru`
  and `turn.skyfall.akimus.ru`. Cloudflare does not proxy either hostname.
- Nginx owns public TCP port 443. TLS SNI sends the API hostname to nginx HTTPS
  on `127.0.0.1:8443` and TURN traffic to coturn on `62.84.172.208:5349`.
- Nginx forwards only `/api/` and `/ws` to Node at `127.0.0.1:8082`.
  Other paths return 404; application files and secrets are not served.
- Node 24 is installed at `/opt/skyfall-node`. `skyfall-api.service` runs as
  the unprivileged `skyfall` user and starts at boot.
- Code: `/opt/skyfall-api/current`, a symlink into `releases/`.
- Environment: `/etc/skyfall-api.env`, root-only mode `0600`, read by systemd.
  It sets `HOST`, `PORT`, `TURN_SECRET`, and `TURN_URLS`.
- API access logging is disabled because room tokens are in query strings.

The existing `server.js` implements room creation, joining, signaling, and
WebSocket relay. It uses `shared/turn.mjs` for temporary TURN credentials.
Rooms are stored in memory and expire after 20 minutes without activity.
Restarting or deploying the API clears rooms; players must create new rooms.
The old Worker API remains for compatibility with cached clients, but its room
codes are separate. Both players should reload after this migration.

## Deployment

`.github/workflows/api.yml` tests and deploys changes to `server.js` or `shared/`
on pushes to `master`/`main`, and supports manual runs. It uses GitHub secrets
`SKYFALL_API_SSH_KEY` and `SKYFALL_API_KNOWN_HOSTS`.

The dedicated SSH key can only run `/usr/local/sbin/skyfall-api-deploy`; it has no
interactive shell, PTY, or forwarding. The forced command accepts
`deploy <commit SHA>`, fetches only `server.js` and `shared/turn.mjs` from that
commit in `xrip/skyfall`, checks syntax, switches the release symlink, and
restarts the service. Failed health checks restore the previous release.
It does not update nginx, systemd, or secrets. Infrastructure source files are
in `deploy/` and must be applied separately when changed.

## Certificates and checks

Certbot renews `/etc/letsencrypt/live/api.skyfall.akimus.ru/` through Cloudflare
DNS validation using `/etc/letsencrypt/cloudflare-skyfall.ini`. The
`reload-skyfall-api` deploy hook checks and reloads nginx after renewal.
The existing `certbot.timer` handles scheduling.

```sh
systemctl status skyfall-api nginx coturn
journalctl -u skyfall-api --since '10 minutes ago'
certbot renew --cert-name api.skyfall.akimus.ru --dry-run
```

`GET /api/rooms` returns JSON with HTTP 405; create a room with POST instead.
Browser tests should create/join a room from GitHub Pages and exchange messages
with TURN forced on, including a separate TLS-only test. Blocking requests to
`skyfall.akimus.ru` and `workers.dev` during the test verifies that signaling no
longer depends on those endpoints.

A firewall that blocks the whole `akimus.ru` suffix can still block these
hostnames. DNS-only removes Cloudflare proxying; it does not override a domain rule.
