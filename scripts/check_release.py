"""Read-only audit of existing tracked and non-ignored release candidates.

Does not stage, commit, publish or display matched secret values.
This heuristic scan is not proof that all possible secrets are absent.
"""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def git(*args, input=None):
    return subprocess.run(
        ['git', '-c', f'safe.directory={ROOT.as_posix()}', *args], cwd=ROOT,
        input=input, capture_output=True, check=True,
    ).stdout


def audit():
    tracked = set(git('ls-files', '-z').decode('utf-8').split('\0')) - {''}
    others = set(git('ls-files', '--others', '--exclude-standard', '-z').decode('utf-8').split('\0')) - {''}
    candidates = sorted(name for name in tracked | others if (ROOT / name).is_file())
    issues = []
    forbidden_parts = {'.local', 'ai-context', '.venv', 'node_modules', '.next', '__pycache__', 'output', 'scraper', 'mu56'}
    patterns = {
        'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
        'telegram-token': re.compile(r'\b\d{8,12}:[A-Za-z0-9_-]{35}\b'),
        'github-token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'),
        'aws-access-key': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
        'credential-url': re.compile(r'(?:postgres(?:ql)?|mysql)://[^\s:/]+:[^\s@]+@'),
    }
    text_suffixes = {'.py', '.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.md', '.yaml', '.yml', '.toml', '.sh', '.ps1', '.example', '.service', '.timer', '.conf', '.txt'}
    for name in candidates:
        file = ROOT / name
        parts = set(Path(name).parts)
        if parts & forbidden_parts or name.startswith(('backend/media/', 'backend/staticfiles/', 'docs/internal/')):
            issues.append({'file': name, 'reason': 'private-or-generated-path'})
        if file.suffix.lower() in {'.dump', '.sql', '.sqlite3', '.pem', '.key', '.p12', '.pfx'} or (file.name.startswith('.env') and file.name != '.env.example'):
            issues.append({'file': name, 'reason': 'private-file-type'})
        if file.stat().st_size >= 100 * 1024 * 1024:
            issues.append({'file': name, 'reason': 'file-at-least-100-MiB'})
        if file.suffix in text_suffixes and file.stat().st_size < 5 * 1024 * 1024:
            content = file.read_text(encoding='utf-8', errors='replace')
            for label, pattern in patterns.items():
                for match in pattern.finditer(content):
                    issues.append({'file': name, 'line': content.count('\n', 0, match.start()) + 1, 'reason': label})
    # Probe exclusions without creating any of these files.
    probes = ['.local/probe.json', 'ai-context/probe.png', 'backend/media/probe.jpg',
              'frontend/.env.local', 'deploy/django.env', 'backup.dump', 'private.key', 'output/probe.json']
    ignored = set(git('check-ignore', '--stdin', '-z', input=('\0'.join(probes) + '\0').encode()).decode().split('\0'))
    for name in probes:
        if name not in ignored:
            issues.append({'file': name, 'reason': 'missing-ignore-rule'})
    required = ['backend/manage.py', 'backend/requirements.txt', 'backend/config/production.py',
                'frontend/package.json', 'frontend/pnpm-lock.yaml', 'frontend/next.config.ts',
                'deploy/requirements.txt', 'deploy/manage.sh', 'deploy/preflight.sh',
                'deploy/django.env.example', 'deploy/frontend.env.example']
    for name in required:
        if name not in candidates:
            issues.append({'file': name, 'reason': 'required-release-file-missing'})
    portraits = (ROOT / 'frontend/src/lib/character-images.ts').read_text(encoding='utf-8')
    for relative in re.findall(r'from "(\.\./\.\./public/[^"]+)"', portraits):
        file = (ROOT / 'frontend/src/lib' / relative).resolve()
        name = file.relative_to(ROOT).as_posix()
        if name not in candidates:
            issues.append({'file': name, 'reason': 'portrait-import-missing'})
    public_references = set()
    for name in candidates:
        if name.startswith('frontend/src/') and Path(name).suffix in {'.ts', '.tsx', '.json', '.css'}:
            content = (ROOT / name).read_text(encoding='utf-8')
            public_references.update(re.findall(r'["\'](/media/[^"\'`\s]+\.(?:png|jpg|jpeg|webp|svg|mp4))["\']', content))
    images = (ROOT / 'frontend/src/lib/images.ts').read_text(encoding='utf-8')
    extensions = re.search(r'const extensions: Record<string, string> = \{([^}]+)\}', images)
    packages = re.search(r'function packageImage\(slug: string\) \{\s*return \[([^]]+)\]', images)
    if not extensions or not packages:
        issues.append({'file': 'frontend/src/lib/images.ts', 'reason': 'dynamic-image-map-needs-audit-update'})
    else:
        for match in re.finditer(r'(?:"([\w-]+)"|(\w+)):\s*"(\w+)"', extensions.group(1)):
            public_references.add(f'/media/services/{match.group(1) or match.group(2)}.{match.group(3)}')
        for slug in re.findall(r'"([\w-]+)"', packages.group(1)):
            public_references.add(f'/media/packages/{slug}.png')
    for reference in sorted(public_references):
        name = 'frontend/public' + reference
        if name not in candidates:
            issues.append({'file': name, 'reason': 'public-image-reference-missing'})
    for name in ('deploy/django.env.example', 'backend/.env.example', 'frontend/.env.example', 'deploy/frontend.env.example'):
        if name not in candidates:
            continue
        for number, line in enumerate((ROOT / name).read_text(encoding='utf-8').splitlines(), 1):
            match = re.match(r'(?:DJANGO_SECRET_KEY|PGPASSWORD|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=(.*)', line)
            if match and match.group(1).strip():
                issues.append({'file': name, 'line': number, 'reason': 'nonempty-secret-in-env-template'})
    public = [name for name in candidates if name.startswith('frontend/public/')]
    return {'result': 'passed' if not issues else 'failed', 'candidate_files': len(candidates),
            'tracked_existing_files': len(tracked & set(candidates)), 'untracked_candidates': len(others),
            'public_asset_files': len(public), 'public_asset_bytes': sum((ROOT / name).stat().st_size for name in public),
            'largest_public_assets': sorted([{'file': name, 'bytes': (ROOT / name).stat().st_size} for name in public], key=lambda x: x['bytes'], reverse=True)[:5],
            'ignore_probes': len(probes), 'public_references_verified': len(public_references), 'portrait_imports_verified': len(re.findall(r'from "\.\./\.\./public/', portraits)), 'issues': issues,
            'scope': 'Current working-tree candidates only; no Git-history audit, staging or publication.'}


if __name__ == '__main__':
    report = audit()
    destination = ROOT / '.local/release-qa/audit.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))
    sys.exit(0 if report['result'] == 'passed' else 1)
