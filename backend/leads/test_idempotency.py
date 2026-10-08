import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.db import close_old_connections, connection
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from .models import Lead, TelegramNotification
from .serializers import LeadCreateSerializer


class SubmissionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.token = self.client.get('/api/v1/csrf/').json()['csrf_token']
        self.payload = {'phone': '+79031112233', 'data_consent': True, 'consent_version': settings.LEAD_CONSENT_VERSION}
        self.key = str(uuid.uuid4())

    def post(self, data=None, key=None):
        return self.client.post('/api/v1/leads/', data or self.payload, format='json', HTTP_X_CSRFTOKEN=self.token, HTTP_IDEMPOTENCY_KEY=key or self.key)

    def test_lost_response_retry_creates_one_lead_and_notification(self):
        first = self.post()
        repeat = self.post()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(repeat.status_code, 200)
        self.assertEqual(first.json(), repeat.json())
        self.assertEqual(Lead.objects.count(), 1)
        self.assertEqual(TelegramNotification.objects.count(), 1)
        self.assertEqual(repeat['Cache-Control'], 'no-store')
        self.assertNotIn('phone', repeat.json())
        self.assertNotIn(self.payload['phone'], Lead.objects.get().submission_fingerprint)

    def test_changed_payload_conflicts_without_overwriting_original(self):
        self.post()
        response = self.post({**self.payload, 'comment': 'Другой праздник'})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Lead.objects.count(), 1)
        self.assertEqual(Lead.objects.get().comment, '')
        self.assertEqual(TelegramNotification.objects.count(), 1)

    def test_new_key_allows_independent_order_for_same_phone(self):
        self.post()
        self.assertEqual(self.post(key=str(uuid.uuid4())).status_code, 201)
        self.assertEqual(Lead.objects.count(), 2)

    def test_invalid_key_and_invalid_payload_do_not_reserve_key(self):
        self.assertEqual(self.post(key='invalid').status_code, 400)
        self.assertEqual(self.post({**self.payload, 'data_consent': False}).status_code, 400)
        self.assertEqual(Lead.objects.count(), 0)
        self.assertEqual(self.post().status_code, 201)

    def test_legacy_client_and_csrf_still_work(self):
        legacy = lambda: self.client.post('/api/v1/leads/', self.payload, format='json', HTTP_X_CSRFTOKEN=self.token)
        self.assertEqual(legacy().status_code, 201)
        self.assertEqual(legacy().status_code, 201)
        self.post()
        response = self.client.post('/api/v1/leads/', self.payload, format='json', HTTP_IDEMPOTENCY_KEY=self.key)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Lead.objects.count(), 3)

    def test_replay_does_not_revalidate_changed_catalog_or_resend_notification(self):
        self.post()
        TelegramNotification.objects.update(status=TelegramNotification.Status.SENT)
        with patch.object(LeadCreateSerializer, 'is_valid', side_effect=AssertionError('Replay must not re-price')):
            self.assertEqual(self.post().status_code, 200)
        self.assertEqual(TelegramNotification.objects.get().status, TelegramNotification.Status.SENT)

    def test_secret_rotation_with_fallback_preserves_replay(self):
        with override_settings(SECRET_KEY='old-test-secret', SECRET_KEY_FALLBACKS=[]):
            first = self.post()
        with override_settings(SECRET_KEY='new-test-secret', SECRET_KEY_FALLBACKS=['old-test-secret']):
            response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(first.json(), response.json())
        self.assertEqual(Lead.objects.count(), 1)
        self.assertEqual(TelegramNotification.objects.count(), 1)


@skipUnless(connection.vendor == 'postgresql', 'Concurrent uniqueness requires the production database engine')
class ConcurrentSubmissionTests(TransactionTestCase):
    def test_concurrent_identical_posts_commit_one_lead_and_one_queue_job(self):
        cache.clear()
        barrier = Barrier(2)
        original_create = LeadCreateSerializer.create
        key = str(uuid.uuid4())
        payload = {'phone': '+79031112233', 'data_consent': True, 'consent_version': settings.LEAD_CONSENT_VERSION}

        def create(serializer, validated):
            barrier.wait(timeout=10)
            return original_create(serializer, validated)

        def post():
            close_old_connections()
            try:
                client = APIClient(enforce_csrf_checks=True)
                token = client.get('/api/v1/csrf/').json()['csrf_token']
                response = client.post('/api/v1/leads/', payload, format='json', HTTP_X_CSRFTOKEN=token, HTTP_IDEMPOTENCY_KEY=key)
                return response.status_code, response.json()['reference']
            finally:
                close_old_connections()

        with patch.object(LeadCreateSerializer, 'create', create), ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: post(), range(2)))
        self.assertEqual(sorted(status for status, _ in results), [200, 201])
        self.assertEqual(len({reference for _, reference in results}), 1)
        self.assertEqual(Lead.objects.count(), 1)
        self.assertEqual(TelegramNotification.objects.count(), 1)
