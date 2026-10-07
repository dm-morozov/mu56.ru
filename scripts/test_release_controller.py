"""Security boundaries for the root-owned deployment controller."""
import importlib.util
import io
import json
from pathlib import Path
import sys
import types
import tempfile
import unittest
from unittest.mock import patch

path = Path(__file__).resolve().parents[1]/'deploy/docker/release-controller.py'
spec = importlib.util.spec_from_file_location('release_controller', path)
controller = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {'fcntl': types.ModuleType('fcntl')}):
    spec.loader.exec_module(controller)

class PayloadTests(unittest.TestCase):
    def payload(self):
        return {'sha': 'a'*40, 'backend': 'ghcr.io/dm-morozov/mu56-backend@sha256:'+'b'*64,
                'frontend': 'ghcr.io/dm-morozov/mu56-frontend@sha256:'+'c'*64, 'token': 'x'*40}

    def test_valid(self):
        result = controller.validate(self.payload())
        self.assertEqual(set(result), {'BACKEND_IMAGE', 'FRONTEND_IMAGE'})

    def test_foreign_namespace(self):
        payload = self.payload()
        payload['backend'] = payload['backend'].replace('dm-morozov', 'other')
        with self.assertRaises(ValueError): controller.validate(payload)

    def test_readiness_uses_configured_domain_for_both_endpoints(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]/'.local/release-controller-tests') as directory:
            root = Path(directory)
            for host in ('mu56.ru', 'dev.mu56.ru'):
                (root/'.env').write_text('SITE_HOST='+host+'\n')
                with patch.object(controller, 'ROOT', root), patch.object(controller.urllib.request, 'urlopen') as open_url:
                    response = open_url.return_value.__enter__.return_value
                    response.status = 200
                    response.read.return_value = b'content'
                    controller.ready()
                    self.assertEqual([call.args[0].get_header('Host') for call in open_url.call_args_list], [host, host])

    def test_readiness_rejects_unexpected_host_without_network_request(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]/'.local/release-controller-tests') as directory:
            root = Path(directory)
            (root/'.env').write_text('SITE_HOST=other.example\n')
            with patch.object(controller, 'ROOT', root), patch.object(controller.urllib.request, 'urlopen') as open_url:
                with self.assertRaises(ValueError): controller.ready()
                open_url.assert_not_called()

    def test_tags_and_command_injection(self):
        for value in ('nginx:latest', self.payload()['backend']+'; id',
                      'ghcr.io/dm-morozov/mu56-backend:latest'):
            payload = self.payload(); payload['backend'] = value
            with self.assertRaises(ValueError): controller.validate(payload)

    def test_extra_fields_and_commit(self):
        payload = self.payload(); payload['command'] = 'id'
        with self.assertRaises(ValueError): controller.validate(payload)

    def test_failed_switch_restores_previous_images_without_advancing_state(self):
        parent = Path(__file__).resolve().parents[1]/'.local/release-controller-tests'
        parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as directory:
            root = Path(directory)
            old = {'BACKEND_IMAGE': 'sha256:'+'d'*64, 'FRONTEND_IMAGE': 'sha256:'+'e'*64}
            (root/'.env').write_text(''.join(k+'='+v+'\n' for k,v in old.items()))
            lock = types.SimpleNamespace(flock=lambda *args: None, LOCK_EX=2, LOCK_NB=4)
            def run(args, *extra):
                return json.dumps({'org.opencontainers.image.revision': 'a'*40})
            with patch.object(controller, 'ROOT', root), patch.object(controller, 'STATE', root/'releases'), \
                 patch.object(controller, 'fcntl', lock), \
                 patch.object(controller.tempfile, 'tempdir', str(parent)), \
                 patch.object(controller.shutil, 'disk_usage', return_value=types.SimpleNamespace(free=8*1024**3)), \
                 patch.object(controller, 'compose', return_value=''), patch.object(controller, 'run', side_effect=run), \
                 patch.object(controller, 'switch', side_effect=[RuntimeError('failed'), None]) as switch, \
                 patch.object(sys, 'argv', ['controller', 'release']), \
                 patch.object(sys, 'stdin', io.StringIO(json.dumps(self.payload()))):
                with self.assertRaises(RuntimeError): controller.main()
                self.assertEqual(switch.call_args_list[1].args[0], old)
                self.assertFalse((root/'releases/current.json').exists())

    def test_worker_is_updated_when_enabled(self):
        images = {'BACKEND_IMAGE': self.payload()['backend'], 'FRONTEND_IMAGE': self.payload()['frontend']}
        with patch.object(controller, 'write_images'), patch.object(controller, 'ready'), \
             patch.object(controller, 'compose', return_value='worker-id') as compose:
            controller.switch(images, worker=True)
            self.assertIn(unittest.mock.call(['up', '-d', '--no-deps', 'worker']), compose.call_args_list)

    def test_failed_worker_is_not_a_successful_release(self):
        with patch.object(controller, 'write_images'), patch.object(controller, 'ready'), \
             patch.object(controller, 'compose', return_value=''):
            with self.assertRaises(RuntimeError): controller.switch({}, worker=True)
        payload = self.payload(); payload['sha'] = 'main'
        with self.assertRaises(ValueError): controller.validate(payload)

if __name__ == '__main__': unittest.main()
