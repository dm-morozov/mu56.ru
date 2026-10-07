from datetime import timedelta
from io import StringIO
import json
from unittest.mock import patch

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import TelegramNotification as Notification
from .serializers import LeadCreateSerializer


@override_settings(TELEGRAM_ENABLED=True, TELEGRAM_BOT_TOKEN="test-token", TELEGRAM_CHAT_ID="12345")
class QueueStatusTests(TestCase):
    def setUp(self):
        serializer = LeadCreateSerializer(data={
            "name": "PRIVATE-NAME", "phone": "+70000000000", "data_consent": True,
            "consent_version": settings.LEAD_CONSENT_VERSION,
        })
        serializer.is_valid(raise_exception=True)
        self.notification = serializer.save().telegram_notification

    def report(self, fails=False):
        output = StringIO()
        if fails:
            with self.assertRaises(CommandError):
                call_command("telegram_status", check=True, stdout=output)
        else:
            call_command("telegram_status", check=True, stdout=output)
        return json.loads(output.getvalue())

    @patch("leads.notifications.bot_request")
    def test_future_retry_is_healthy_and_check_is_read_only(self, send):
        self.notification.next_attempt_at = timezone.now() + timedelta(minutes=8)
        self.notification.save()
        before = Notification.objects.values().get(pk=self.notification.pk)
        report = self.report()
        self.assertTrue(report["healthy"])
        self.assertEqual(before, Notification.objects.values().get(pk=self.notification.pk))
        self.assertNotIn("PRIVATE-NAME", json.dumps(report))
        self.assertNotIn("+70000000000", json.dumps(report))
        send.assert_not_called()

    def test_overdue_pending_requires_attention(self):
        Notification.objects.update(next_attempt_at=timezone.now() - timedelta(minutes=6))
        self.assertEqual(self.report(fails=True)["overdue_pending"], 1)

    def test_stale_sender_requires_attention_without_retry(self):
        Notification.objects.update(status="sending", started_at=timezone.now() - timedelta(minutes=3))
        self.assertEqual(self.report(fails=True)["stale_sending"], 1)
        self.notification.refresh_from_db()
        self.assertEqual(self.notification.status, "sending")

    def test_uncertain_and_failed_require_manual_review(self):
        for status in ["uncertain", "failed"]:
            with self.subTest(status=status):
                Notification.objects.update(status=status)
                self.assertEqual(self.report(fails=True)["needs_manual_review"], 1)

    @override_settings(TELEGRAM_ENABLED=False)
    def test_disabled_bot_does_not_pass_even_with_empty_queue(self):
        Notification.objects.all().delete()
        self.assertFalse(self.report(fails=True)["configured"])
