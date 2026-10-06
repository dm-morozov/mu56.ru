#!/usr/bin/python3
"""Root-owned, read-only entry point for the restricted deployment account."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path('/srv/projects/mu56')

def main():
    if sys.argv[1:] != ['status']:
        raise SystemExit('Only status is enabled; deployment is not enabled yet')
    result = subprocess.run(
        ['/usr/bin/docker', 'compose', '-f', str(ROOT / 'compose.yml'),
         'ps', '--format', 'json'], cwd=ROOT, check=True,
        capture_output=True, text=True, timeout=30,
        env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root'},
    )
    services = [json.loads(line) for line in result.stdout.splitlines() if line]
    # Never return container environments, logs, secrets or arbitrary host paths.
    print(json.dumps({'project': 'mu56', 'services': [
        {key: item.get(key, '') for key in ('Service', 'State', 'Health', 'Image')}
        for item in services
    ]}, ensure_ascii=False))

if __name__ == '__main__':
    main()
