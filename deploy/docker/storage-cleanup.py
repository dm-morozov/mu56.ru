#!/usr/bin/python3
"""Manual, project-scoped cleanup; default is a dry run."""
import fcntl
import importlib.util
import json
from pathlib import Path
import sys

if sys.argv[1:] not in ([], ['--apply']):
    raise SystemExit('Use no arguments for dry run, or --apply')
spec = importlib.util.spec_from_file_location('controller', Path(__file__).with_name('release-controller.py'))
controller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controller)
with (controller.STATE/'.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    print(json.dumps(controller.cleanup_images(apply=sys.argv[1:] == ['--apply'])))
