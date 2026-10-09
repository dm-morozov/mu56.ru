"""Verify image deletion boundaries without a Docker daemon."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('cleanup_controller', Path(__file__).resolve().parents[1]/'deploy/docker/release-controller.py')
controller = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {'fcntl': types.ModuleType('fcntl')}):
    spec.loader.exec_module(controller)

class CleanupTests(unittest.TestCase):
    def test_only_obsolete_project_images_removed_and_all_containers_protected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, refs in [('current', ['a', 'b']), ('previous', ['c', 'd'])]:
                (root/(name+'.json')).write_text(json.dumps({'images': dict(zip(['BACKEND_IMAGE', 'FRONTEND_IMAGE'], refs))}))
            removed = []
            def run(args):
                if args[1:3] == ['ps', '-aq']:
                    return 'container'
                if args[1] == 'inspect':
                    return json.dumps([{'Image': 'e'}])
                if args[1:3] == ['image', 'ls']:
                    return 'a b c d e f g h'
                if args[1:3] == ['image', 'rm']:
                    self.assertEqual(args[3], '--no-prune')
                    self.assertNotIn('--force', args)
                    removed.append(args[4])
                    return ''
                if len(args) == 4:
                    return json.dumps([{'Id': args[-1]}])
                return json.dumps([{'Id': value, 'RepoDigests': ['ghcr.io/dm-morozov/mu56-frontend@sha256:'+value]} for value in 'abcdef'] + [
                    {'Id': 'g', 'RepoTags': ['another-project:latest']},
                    {'Id': 'h', 'RepoTags': ['mu56-frontend:old', 'another-project:shared']}])
            with patch.object(controller, 'STATE', root), patch.object(controller, 'run', run):
                self.assertEqual(controller.cleanup_images()['candidates'], ['f'])
                self.assertEqual(removed, [])
                controller.cleanup_images(apply=True)
                self.assertEqual(removed, ['f'])

    def test_missing_previous_release_blocks_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'current.json').write_text(json.dumps({'images': {'BACKEND_IMAGE': 'a', 'FRONTEND_IMAGE': 'b'}}))
            with patch.object(controller, 'STATE', root), patch.object(controller, 'run', return_value='[{"Id":"a"}]') as run:
                with self.assertRaises(FileNotFoundError):
                    controller.cleanup_images(apply=True)
                self.assertFalse(any(call.args[0][1:3] == ['image', 'rm'] for call in run.call_args_list))

if __name__ == '__main__':
    unittest.main()
