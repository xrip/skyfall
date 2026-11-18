# SKYFALL TURN

The production game receives temporary TURN credentials when a player creates
or joins a room. Direct WebRTC is preferred; TURN relays traffic when needed.
The local Node server still uses the manual TURN fields.

## Server

- Host: `root@62.84.172.208`, Debian 12, coturn package.
- Service: `coturn.service`, enabled at boot.
- Configuration: `/etc/turnserver.conf` (`root:turnserver`, mode `0640`).
- Original configuration backup: `/root/skyfall-turn-backup/turnserver.conf.original`.
- Shared secret: `/root/skyfall-turn-secret` (`root`, mode `0600`).
- Client listeners: UDP and TCP `3478`, TLS over TCP `443`.
- TLS hostname: `turn.skyfall.akimus.ru`, DNS-only A record to the server IP.
- Relay range: UDP `62000–62199`.
- No host firewall was active during installation. A provider firewall must
  allow the client listeners and relay range if one is added later.

Coturn uses `use-auth-secret`, HMAC-SHA1 credentials, and realm
`skyfall.akimus.ru`. The Worker stores the same value as the secret `TURN_SECRET`.
Never put that value in Git, browser code, or the public `TURN_URLS` variable.

The server allows 12 allocations per temporary user and 128 in total, with
limits of 1,000,000 bytes/s per session and 12,000,000 bytes/s in total.
Loopback, private, link-local, shared-address, and multicast peer ranges are
blocked. The admin CLI and TCP relay allocations are disabled; client-to-TURN
TCP connections remain enabled.

## TLS and certificate renewal

Certbot manages the certificate at
`/etc/letsencrypt/live/turn.skyfall.akimus.ru/` using the Cloudflare DNS plugin.
DNS validation needs no public HTTP listener. The API credential is stored in
`/etc/letsencrypt/cloudflare-skyfall.ini` with root-only `0600` access.
If the Cloudflare token is replaced, update that file as well.

`certbot.timer` runs renewal checks. The deploy hook
`/etc/letsencrypt/renewal-hooks/deploy/restart-skyfall-turn` copies the renewed
certificate and key into `/etc/coturn/tls/`, then restarts coturn. The key is
readable only by root and the turnserver group. A systemd drop-in grants coturn
`CAP_NET_BIND_SERVICE` so it can listen on port 443 as the turnserver user.

Check renewal without replacing the live certificate:

```sh
certbot renew --cert-name turn.skyfall.akimus.ru --dry-run
```

## Game configuration

`wrangler.jsonc` contains the public `TURN_URLS`. `worker/turn.js` issues a unique
username with a 24-hour expiry and its HMAC credential. Only successful room
creation and join responses include credentials; responses are not cached.
No permanent password is sent to browsers.

The game uses these credentials for both peers and reconnect attempts.
Manual TURN settings in localStorage take priority. Clear the manual URL to
return to automatic TURN. Credentials are not renewed for a room open longer
than 24 hours; create a new room for a fresh set.

## Checks and operations

```sh
systemctl status coturn
journalctl -u coturn --since '10 minutes ago'
systemctl restart coturn
```

Credential and client fallback tests:

```sh
node --test tools/turn.test.mjs
```

For a real relay test, use two RTCPeerConnections with
`iceTransportPolicy: 'relay'`, exchange a DataChannel message, and check that
the selected candidates on both sides have `candidateType: 'relay'`.
Test UDP, TCP, and TLS separately. A successful STUN response alone is not a relay test.

The live server passed this check from Chrome on 2026-11-18 over both UDP and
TCP, with an echoed payload and relay candidates on both peers.

If the shared secret changes, update both the coturn configuration and the
Worker secret. Existing temporary credentials will become invalid. Deployment
through GitHub Actions preserves Worker secrets.
