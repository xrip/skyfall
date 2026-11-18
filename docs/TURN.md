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
- Client listeners: UDP and TCP `3478`.
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
Test UDP and TCP separately. A successful STUN response alone is not a relay test.

The live server passed this check from Chrome on 2026-11-18 over both UDP and
TCP, with an echoed payload and relay candidates on both peers.

If the shared secret changes, update both the coturn configuration and the
Worker secret. Existing temporary credentials will become invalid. Deployment
through GitHub Actions preserves Worker secrets.
