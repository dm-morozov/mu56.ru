#!/usr/bin/python3
"""One-time guarded patch of the verified VPS controller; preserves live fixes."""
import ast
import fcntl
import hashlib
from pathlib import Path
import shutil

root = Path('/srv/projects/mu56')
target = Path('/usr/local/sbin/mu56-release')
expected = 'b5f63298bc6bc50ba17cc3fcee8aaa855095dd986c0b2184f7375ac4d389cf40'
source = (root/'storage-cleanup-controller-source.py').read_text()
node = next(item for item in ast.parse(source).body if isinstance(item, ast.FunctionDef) and item.name == 'cleanup_images')
function = '\n'.join(source.splitlines()[node.lineno-1:node.end_lineno])
anchor = "        atomic(current, json.dumps(new_state))\n"
hook = """        try:
            cleanup_images(apply=True)
        except Exception:
            print('Warning: old image cleanup incomplete; inspect storage', file=sys.stderr)
"""
with (root/'releases/.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    for file in (target, root/'release-controller.py'):
        if hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            raise RuntimeError('Controller changed; stop and review')
    live = target.read_text()
    if live.count(anchor) != 1 or '\ndef main():' not in live or 'def cleanup_images(' in live:
        raise RuntimeError('Unexpected controller layout')
    patched = live.replace('\ndef main():', '\n'+function+'\n\ndef main():').replace(anchor, anchor+hook)
    compile(patched, str(target), 'exec')
    backup = root/'storage-maintenance-20261008'
    backup.mkdir(mode=0o700, exist_ok=False)
    for file in (target, root/'release-controller.py'):
        shutil.copy2(file, backup/(file.name+'.before'))
        temporary = file.with_name(file.name+'.storage-new')
        temporary.write_text(patched)
        temporary.chmod(file.stat().st_mode & 0o777)
        temporary.replace(file)
    print('Installed cleanup hook; original controllers preserved')
