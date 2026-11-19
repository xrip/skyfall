#!/usr/bin/python3
"""Forced SSH command: deploy one commit from xrip/skyfall, with health rollback."""
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request

match = re.fullmatch(r'deploy ([0-9a-f]{40})', os.environ.get('SSH_ORIGINAL_COMMAND', ''))
if not match:
    raise SystemExit('Expected: deploy <40-character commit SHA>')
sha = match[1]
root = Path('/opt/skyfall-api')
release = root / 'releases' / sha
for name in ['server.js', 'shared/turn.mjs']:
    target = release / name
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(f'https://raw.githubusercontent.com/xrip/skyfall/{sha}/{name}', timeout=30) as response:
        target.write_bytes(response.read())
    subprocess.run(['/opt/skyfall-node/bin/node', '--check', str(target)], check=True)

current = root / 'current'
previous = current.readlink() if current.is_symlink() else None

def activate(target):
    temporary = root / 'next'
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    temporary.replace(current)
    subprocess.run(['systemctl', 'restart', 'skyfall-api'], check=True)

try:
    activate(release)
    for attempt in range(40):
        try:
            urllib.request.urlopen('http://127.0.0.1:8082/api/rooms', timeout=2).close()
        except urllib.error.HTTPError as error:
            if error.code == 405 and 'application/json' in error.headers.get('Content-Type', ''):
                print(f'Deployed SKYFALL API {sha}')
                break
        except OSError:
            pass
        time.sleep(0.25)
    else:
        raise RuntimeError('API health check failed')
except Exception:
    if previous is not None:
        activate(previous)
    raise
