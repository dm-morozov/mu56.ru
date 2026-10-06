"""Security boundaries for the root-owned deployment controller."""
import importlib.util
from pathlib import Path
import sys
import types
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

    def test_tags_and_command_injection(self):
        for value in ('nginx:latest', self.payload()['backend']+'; id',
                      'ghcr.io/dm-morozov/mu56-backend:latest'):
            payload = self.payload(); payload['backend'] = value
            with self.assertRaises(ValueError): controller.validate(payload)

    def test_extra_fields_and_commit(self):
        payload = self.payload(); payload['command'] = 'id'
        with self.assertRaises(ValueError): controller.validate(payload)
        payload = self.payload(); payload['sha'] = 'main'
        with self.assertRaises(ValueError): controller.validate(payload)

if __name__ == '__main__': unittest.main()
