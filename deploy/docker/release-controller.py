#!/usr/bin/python3
"""Root-owned controller: fixed Compose project, validated image references only."""
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = Path('/srv/projects/mu56')
STATE = ROOT / 'releases'
BASE = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root'}

def run(args, env=None, data=None):
    return subprocess.run(args, cwd=ROOT, env=env or BASE, input=data,
                          text=True, capture_output=True, timeout=900, check=True).stdout

def compose(args, images=None):
    return run(['/usr/bin/docker', 'compose', '-f', str(ROOT/'compose.yml'), *args],
               {**BASE, **(images or {})})

def validate(payload):
    if set(payload) != {'sha', 'backend', 'frontend', 'token'}:
        raise ValueError('Unexpected payload fields')
    if not re.fullmatch('[0-9a-f]{40}', payload['sha']):
        raise ValueError('Invalid commit')
    for service in ('backend', 'frontend'):
        pattern = 'ghcr.io/dm-morozov/mu56-' + service + '@sha256:[0-9a-f]{64}'
        if not re.fullmatch(pattern, payload[service]):
            raise ValueError('Invalid image namespace or digest')
    if not isinstance(payload['token'], str) or not 20 <= len(payload['token']) <= 1000:
        raise ValueError('Invalid registry credential')
    return {'BACKEND_IMAGE': payload['backend'], 'FRONTEND_IMAGE': payload['frontend']}

def atomic(path, text):
    tmp = path.with_suffix('.tmp')
    with tmp.open('w') as handle:
        os.chmod(tmp, 0o600)
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
    tmp.replace(path)

def write_images(images):
    text = (ROOT/'.env').read_text()
    for key, value in images.items():
        text, count = re.subn(r'^'+key+r'=.*$', key+'='+value, text, flags=re.M)
        if count != 1:
            raise ValueError('Missing or duplicate image setting')
    atomic(ROOT/'.env', text)

def ready():
    for _ in range(60):
        try:
            for path in ('/', '/api/v1/offerings/'):
                req = urllib.request.Request('http://127.0.0.1:18080'+path,
                                              headers={'Host': 'dev.mu56.ru'})
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status != 200 or not response.read(512):
                        raise ValueError('Empty response')
            return
        except Exception:
            time.sleep(2)
    raise RuntimeError('Readiness failed')

def switch(images, worker=False):
    write_images(images)
    compose(['up', '-d', '--no-deps', 'backend', 'frontend'])
    compose(['exec', '-T', 'backend', 'python', 'manage.py', 'collectstatic', '--noinput'])
    ready()
    if worker:
        compose(['up', '-d', '--no-deps', 'worker'])
        if not compose(['ps', '--status', 'running', '-q', 'worker']).strip():
            raise RuntimeError('Notification worker did not start')

def main():
    if sys.argv[1:] not in (['release'], ['rollback']):
        raise ValueError('Unsupported operation')
    STATE.mkdir(mode=0o700, exist_ok=True)
    with (STATE/'.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if shutil.disk_usage(ROOT).free < 4*1024**3:
            raise RuntimeError('Less than 4 GiB free')
        worker = bool(compose(['ps', '--status', 'running', '-q', 'worker']).strip())
        old = {key: value for key, value in
               (line.split('=', 1) for line in (ROOT/'.env').read_text().splitlines()
                if '=' in line) if key in ('BACKEND_IMAGE', 'FRONTEND_IMAGE')}
        current = STATE/'current.json'
        old_state = json.loads(current.read_text()) if current.exists() else {
            'images': old, 'sha': 'initial-manual-release'}
        if sys.argv[1] == 'release':
            raw = sys.stdin.read(16385)
            if len(raw) > 16384:
                raise ValueError('Payload too large')
            payload = json.loads(raw)
            images = validate(payload)
            with tempfile.TemporaryDirectory(prefix='mu56-registry-') as directory:
                env = {**BASE, 'DOCKER_CONFIG': directory}
                run(['/usr/bin/docker', 'login', 'ghcr.io', '-u', 'dm-morozov',
                     '--password-stdin'], env, payload.pop('token'))
                for image in images.values():
                    run(['/usr/bin/docker', 'pull', image], env)
                    labels = json.loads(run(['/usr/bin/docker', 'image', 'inspect', image,
                                              '--format', '{{json .Config.Labels}}']))
                    if labels.get('org.opencontainers.image.revision') != payload['sha']:
                        raise ValueError('Image commit mismatch')
            compose(['run', '--rm', '--no-deps', 'backend', 'python', 'manage.py',
                     'migrate', '--check'], images)
            new_state = {'images': images, 'sha': payload['sha']}
        else:
            new_state = json.loads((STATE/'previous.json').read_text())
            images = new_state['images']
            for image in images.values():
                run(['/usr/bin/docker', 'image', 'inspect', image])
            compose(['run', '--rm', '--no-deps', 'backend', 'python', 'manage.py',
                     'migrate', '--check'], images)
        run(['/usr/bin/systemctl', 'start', 'mu56-docker-backup.service'])
        try:
            switch(images, worker=worker)
        except Exception:
            switch(old, worker=worker)
            raise RuntimeError('Update failed; previous images restored')
        atomic(STATE/'previous.json', json.dumps(old_state))
        atomic(current, json.dumps(new_state))
        print(json.dumps({'success': True, 'sha': new_state['sha']}))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Subprocess output can contain application secrets: do not forward it.
        print('Release failed: '+type(error).__name__, file=sys.stderr)
        sys.exit(1)
