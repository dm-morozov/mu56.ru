from datetime import timedelta
import uuid

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Lead, TelegramNotification as Notification
from .telegram import TelegramError, bot_request, notification_payload


def configured():
    return bool(settings.TELEGRAM_ENABLED and settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)


def process_one():
    if not configured():
        return False
    now = timezone.now()
    # A crashed sender may have delivered. Do not blindly send it again.
    with transaction.atomic():
        expired = list(Notification.objects.select_for_update(skip_locked=True).filter(status=Notification.Status.SENDING, started_at__lt=now - timedelta(minutes=2)))
        Notification.objects.filter(pk__in=[row.pk for row in expired]).update(status=Notification.Status.UNCERTAIN, last_error="Обработчик прерван: проверьте Telegram перед повтором", claim_token=None)
        Lead.objects.filter(pk__in=[row.lead_id for row in expired]).update(notification_status=Notification.Status.UNCERTAIN.label)
        notification = Notification.objects.select_for_update(skip_locked=True).filter(status=Notification.Status.PENDING, next_attempt_at__lte=now).order_by("next_attempt_at", "pk").first()
        if not notification:
            return False
        token = uuid.uuid4()
        notification.status = Notification.Status.SENDING
        notification.claim_token = token
        notification.started_at = now
        notification.attempts += 1
        notification.save(update_fields=["status", "claim_token", "started_at", "attempts"])
        Lead.objects.filter(pk=notification.lead_id).update(notification_status=notification.get_status_display())
    try:
        result = bot_request(settings.TELEGRAM_BOT_TOKEN, "sendMessage", notification_payload(notification.lead, settings.TELEGRAM_CHAT_ID))
        if not isinstance(result, dict) or not isinstance(result.get("message_id"), int):
            raise TelegramError("Нет ID отправленного сообщения", uncertain=True)
        values = {"status": Notification.Status.SENT, "sent_at": timezone.now(), "message_id": result["message_id"], "last_error": ""}
    except TelegramError as error:
        retry = error.retry_after is not None and notification.attempts < 5
        state = Notification.Status.UNCERTAIN if error.uncertain else Notification.Status.PENDING if retry else Notification.Status.FAILED
        values = {"status": state, "last_error": str(error)}
        if retry:
            values["next_attempt_at"] = timezone.now() + timedelta(seconds=max(error.retry_after, min(60 * 2 ** (notification.attempts - 1), 3600)))
    with transaction.atomic():
        changed = Notification.objects.filter(pk=notification.pk, claim_token=token, status=Notification.Status.SENDING).update(**values, claim_token=None)
        if changed:
            Lead.objects.filter(pk=notification.lead_id).update(notification_status=Notification.Status(values["status"]).label)
    return True


def retry_notifications(lead_ids):
    with transaction.atomic():
        rows = list(Notification.objects.select_for_update().filter(lead_id__in=lead_ids, status__in=[Notification.Status.FAILED, Notification.Status.UNCERTAIN]))
        ids = [row.pk for row in rows]
        Notification.objects.filter(pk__in=ids).update(status=Notification.Status.PENDING, next_attempt_at=timezone.now(), attempts=0, claim_token=None, last_error="")
        Lead.objects.filter(pk__in=[row.lead_id for row in rows]).update(notification_status=Notification.Status.PENDING.label)
    return len(ids)
