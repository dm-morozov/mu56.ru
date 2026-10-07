"""Read-only queue checks; never calls Telegram or exposes customer data."""
from datetime import timedelta
import json

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count, Q
from django.utils import timezone

from leads.models import TelegramNotification as Notification
from leads.notifications import configured


class Command(BaseCommand):
    help = "Проверяет очередь Telegram без отправки сообщений; --check сигнализирует о проблемах кодом выхода."

    def add_arguments(self, parser):
        parser.add_argument("--check", action="store_true")

    def handle(self, *args, **options):
        now = timezone.now()
        queue = Notification.objects.all()
        counts = dict(queue.values_list("status").annotate(count=Count("pk")))
        stale = queue.filter(status=Notification.Status.SENDING).filter(
            Q(started_at__lt=now - timedelta(minutes=2)) | Q(started_at__isnull=True)
        ).count()
        overdue = queue.filter(
            status=Notification.Status.PENDING,
            next_attempt_at__lt=now - timedelta(minutes=5),
        ).count()
        attention = counts.get(Notification.Status.FAILED, 0) + counts.get(Notification.Status.UNCERTAIN, 0)
        enabled = configured()
        healthy = enabled and not (stale or overdue or attention)
        self.stdout.write(json.dumps({
            "configured": enabled,
            "queue": {status: counts.get(status, 0) for status in Notification.Status.values},
            "overdue_pending": overdue,
            "stale_sending": stale,
            "needs_manual_review": attention,
            "healthy": healthy,
            "scope": "Queue only; no network or worker liveness check",
        }, ensure_ascii=False))
        if options["check"] and not healthy:
            raise CommandError("Очередь требует проверки или Telegram не настроен.")
