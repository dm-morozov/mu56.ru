from datetime import timedelta
from io import StringIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import Lead, TelegramNotification as Notification
from .notifications import process_one, retry_notifications
from .serializers import LeadCreateSerializer
from .telegram import TelegramError, bot_request, notification_payload


@override_settings(TELEGRAM_ENABLED=True, TELEGRAM_BOT_TOKEN="123456:test-token", TELEGRAM_CHAT_ID="12345")
class NotificationTests(TestCase):
    def setUp(self):
        serializer = LeadCreateSerializer(data={"name": "Тест", "phone": "+79031112233", "comment": "<b>Не разметка</b>", "data_consent": True})
        serializer.is_valid(raise_exception=True)
        self.lead = serializer.save()
        self.notification = self.lead.telegram_notification

    def refresh(self):
        self.notification.refresh_from_db()
        self.lead.refresh_from_db()

    @patch("leads.notifications.bot_request", return_value={"message_id": 42})
    def test_durable_queue_and_sent_notification_not_sent_twice(self, send):
        self.assertEqual(self.notification.status, Notification.Status.PENDING)
        self.assertTrue(process_one())
        self.refresh()
        self.assertEqual(self.notification.status, Notification.Status.SENT)
        self.assertEqual(self.notification.message_id, 42)
        self.assertIsNotNone(self.notification.sent_at)
        self.assertEqual(self.lead.notification_status, "Отправлено")
        self.assertFalse(process_one())
        self.assertEqual(retry_notifications([self.lead.pk]), 0)
        send.assert_called_once()
        payload = send.call_args.args[2]
        self.assertEqual(payload["chat_id"], "12345")
        self.assertIn("<b>Не разметка</b>", payload["text"])
        self.assertNotIn("parse_mode", payload)

    @override_settings(TELEGRAM_ENABLED=False)
    @patch("leads.notifications.bot_request")
    def test_disabled_keeps_queue_without_network(self, send):
        self.assertFalse(process_one())
        self.refresh()
        self.assertEqual(self.notification.attempts, 0)
        send.assert_not_called()
        with self.assertRaises(CommandError):
            call_command("telegram_worker", once=True, stdout=StringIO())

    @patch("leads.notifications.bot_request", side_effect=TelegramError("Частота", retry_after=120))
    def test_retry_after_delay_and_retry_limit(self, send):
        before = timezone.now()
        process_one()
        self.refresh()
        self.assertEqual(self.notification.status, Notification.Status.PENDING)
        self.assertGreaterEqual(self.notification.next_attempt_at, before + timedelta(seconds=120))
        self.assertFalse(process_one())
        for attempt in range(2, 6):
            Notification.objects.filter(pk=self.notification.pk).update(next_attempt_at=timezone.now())
            process_one()
        self.refresh()
        self.assertEqual(self.notification.attempts, 5)
        self.assertEqual(self.notification.status, Notification.Status.FAILED)
        self.assertEqual(send.call_count, 5)

    @patch("leads.notifications.bot_request", side_effect=TelegramError("Сеть", uncertain=True))
    def test_uncertain_delivery_requires_explicit_retry(self, send):
        process_one()
        self.refresh()
        self.assertEqual(self.notification.status, Notification.Status.UNCERTAIN)
        self.assertFalse(process_one())
        self.assertEqual(retry_notifications([self.lead.pk]), 1)
        self.refresh()
        self.assertEqual(self.notification.attempts, 0)
        self.assertEqual(self.notification.status, Notification.Status.PENDING)

    @patch("leads.notifications.bot_request", side_effect=TelegramError("Бот заблокирован"))
    def test_permanent_error_preserves_lead(self, send):
        process_one()
        self.refresh()
        self.assertEqual(self.notification.status, Notification.Status.FAILED)
        self.assertEqual(self.lead.status, Lead.Status.NEW)
        self.assertEqual(self.lead.phone, "+79031112233")

    @patch("leads.notifications.bot_request")
    def test_abandoned_claim_is_not_automatically_resent(self, send):
        Notification.objects.filter(pk=self.notification.pk).update(status=Notification.Status.SENDING, started_at=timezone.now() - timedelta(minutes=3))
        self.assertFalse(process_one())
        self.refresh()
        self.assertEqual(self.notification.status, Notification.Status.UNCERTAIN)
        send.assert_not_called()

    def test_snapshot_and_long_text_are_safe(self):
        self.lead.comment = "🎉" * 2000
        self.lead.selection_snapshot = {"offering": {"name": "Название на момент заявки"}, "known_program_amount_rub": 9500, "addons": [{"name": "Дополнение"}]}
        payload = notification_payload(self.lead, "12345")
        self.assertIn("Название на момент заявки", payload["text"])
        self.assertIn("9 500 ₽", payload["text"])
        self.assertLessEqual(len(payload["text"].encode("utf-16-le")), 7800)
        self.assertNotIn("parse_mode", payload)
        self.assertNotIn("manager_notes", payload["text"])

    @patch("leads.serializers.TelegramNotification.objects.create", side_effect=RuntimeError("queue unavailable"))
    def test_lead_and_queue_are_saved_atomically(self, create):
        count = Lead.objects.count()
        serializer = LeadCreateSerializer(data={"phone": "+79031112233", "data_consent": True})
        serializer.is_valid(raise_exception=True)
        with self.assertRaises(RuntimeError):
            serializer.save()
        self.assertEqual(Lead.objects.count(), count)

    def test_admin_shows_queue_and_limits_retry_action(self):
        user = get_user_model().objects.create_superuser(username="notification-test", password=None)
        self.client.force_login(user)
        page = self.client.get(f"/admin/leads/lead/{self.lead.pk}/change/")
        self.assertContains(page, "Уведомление Telegram")
        self.assertContains(page, "Ожидает отправки")
        Notification.objects.filter(pk=self.notification.pk).update(status=Notification.Status.FAILED)
        response = self.client.post("/admin/leads/lead/", {"action": "retry_telegram", "_selected_action": [str(self.lead.pk)]})
        self.assertEqual(response.status_code, 302)
        self.refresh()
        self.assertEqual(self.notification.status, Notification.Status.PENDING)


class TelegramTransportTests(TestCase):
    @patch("leads.telegram.build_opener")
    def test_plain_json_post_with_timeout(self, opener):
        response = Mock()
        response.read.return_value = b'{"ok": true, "result": {"message_id": 5}}'
        opener.return_value.open.return_value.__enter__.return_value = response
        self.assertEqual(bot_request("123:fake-token", "sendMessage", {"chat_id": "42", "text": "Test"})["message_id"], 5)
        args, kwargs = opener.return_value.open.call_args
        self.assertEqual(args[0].get_method(), "POST")
        self.assertEqual(json.loads(args[0].data)["chat_id"], "42")
        self.assertEqual(kwargs["timeout"], 10)

    @patch("leads.telegram.build_opener")
    def test_errors_do_not_expose_token_or_remote_description(self, opener):
        token = "123:secret-token"
        error = HTTPError(f"https://api.telegram.org/bot{token}/sendMessage", 429, "remote", {}, StringIO())
        error.read = Mock(return_value=json.dumps({"description": token, "parameters": {"retry_after": 90}}).encode())
        opener.return_value.open.side_effect = error
        with self.assertRaises(TelegramError) as caught:
            bot_request(token, "sendMessage")
        self.assertNotIn(token, str(caught.exception))
        self.assertEqual(caught.exception.retry_after, 90)
        opener.return_value.open.side_effect = URLError(token)
        with self.assertRaises(TelegramError) as caught:
            bot_request(token, "sendMessage")
        self.assertTrue(caught.exception.uncertain)
        self.assertNotIn(token, str(caught.exception))

    @patch("leads.telegram.build_opener")
    def test_invalid_token_never_requests_network(self, opener):
        with self.assertRaises(TelegramError):
            bot_request("bad/token", "getMe")
        opener.assert_not_called()


class ConfigureTelegramTests(TestCase):
    @patch("leads.management.commands.configure_telegram.secrets.token_urlsafe", return_value="same-code")
    @patch("leads.management.commands.configure_telegram.getpass.getpass", return_value="123:fake-token")
    @patch("builtins.input", side_effect=["", "", "да"])
    @patch("leads.management.commands.configure_telegram.bot_request")
    def test_delayed_start_retries_same_link_without_reentering_token(self, request, user_input, password, nonce):
        request.side_effect = [
            {"is_bot": True, "username": "test_bot"}, {"url": ""}, [],
            [{"message": {"text": "/start same-code", "from": {"id": 42}, "chat": {"id": 42, "type": "private"}}}],
        ]
        with TemporaryDirectory() as temporary, override_settings(DEBUG=True, BASE_DIR=Path(temporary) / "backend"):
            output = StringIO()
            call_command("configure_telegram", stdout=output)
            saved = json.loads((Path(temporary) / ".local/telegram.json").read_text())
            self.assertEqual(saved["chat_id"], 42)
            self.assertIn("ссылка не меняется", output.getvalue())
        password.assert_called_once()
        nonce.assert_called_once()
        self.assertEqual(request.call_args_list[-1].args[2]["timeout"], 5)

    @patch("leads.management.commands.configure_telegram.getpass.getpass", return_value="123:fake-token")
    @patch("builtins.input", return_value="q")
    @patch("leads.management.commands.configure_telegram.bot_request", side_effect=[{"is_bot": True, "username": "test_bot"}, {"url": ""}])
    def test_cancel_does_not_save_or_read_updates(self, request, user_input, password):
        with TemporaryDirectory() as temporary, override_settings(DEBUG=True, BASE_DIR=Path(temporary) / "backend"):
            call_command("configure_telegram", stdout=StringIO())
            self.assertFalse((Path(temporary) / ".local/telegram.json").exists())
        self.assertEqual(request.call_count, 2)

    @patch("leads.management.commands.configure_telegram.secrets.token_urlsafe", return_value="one-time-code")
    @patch("leads.management.commands.configure_telegram.getpass.getpass", return_value="123:fake-token")
    @patch("builtins.input", side_effect=["", "да"])
    @patch("leads.management.commands.configure_telegram.bot_request")
    def test_only_private_chat_with_matching_start_is_saved(self, request, user_input, password, nonce):
        request.side_effect = [
            {"is_bot": True, "username": "test_bot"}, {"url": ""},
            [{"message": {"text": "/start wrong", "from": {"id": 1}, "chat": {"id": 1, "type": "private"}}},
             {"message": {"text": "/start one-time-code", "from": {"id": 2}, "chat": {"id": -3, "type": "group"}}},
             {"message": {"text": "/start one-time-code", "from": {"id": 42}, "chat": {"id": 42, "type": "private", "first_name": "Владелец"}}}],
        ]
        with TemporaryDirectory() as temporary, override_settings(DEBUG=True, BASE_DIR=Path(temporary) / "backend"):
            output = StringIO()
            call_command("configure_telegram", stdout=output)
            saved = json.loads((Path(temporary) / ".local/telegram.json").read_text())
            self.assertEqual(saved["chat_id"], 42)
            self.assertTrue(saved["enabled"])
            self.assertNotIn("fake-token", output.getvalue())

    @patch("leads.management.commands.configure_telegram.getpass.getpass", return_value="123:fake-token")
    @patch("leads.management.commands.configure_telegram.bot_request", side_effect=[{"is_bot": True, "username": "test_bot"}, {"url": "https://already-used.example"}])
    def test_existing_webhook_is_preserved(self, request, password):
        with TemporaryDirectory() as temporary, override_settings(DEBUG=True, BASE_DIR=Path(temporary) / "backend"):
            with self.assertRaises(CommandError):
                call_command("configure_telegram", stdout=StringIO())
            self.assertFalse((Path(temporary) / ".local/telegram.json").exists())
        self.assertEqual([call.args[1] for call in request.call_args_list], ["getMe", "getWebhookInfo"])
