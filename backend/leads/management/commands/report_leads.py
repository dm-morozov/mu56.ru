"""Read-only aggregates for comparing the database with analytics."""
import json
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count

from leads.models import Lead, TelegramNotification


class Command(BaseCommand):
    help = "Агрегаты заявок за даты Оренбурга; без персональных данных и отправки Telegram."

    def add_arguments(self, parser):
        parser.add_argument("--start", required=True, help="Первый день, YYYY-MM-DD (включительно).")
        parser.add_argument("--end", required=True, help="Последний день, YYYY-MM-DD (включительно).")

    def handle(self, *args, **options):
        try:
            start, end = date.fromisoformat(options["start"]), date.fromisoformat(options["end"])
            if start > end:
                raise ValueError
            next_day = end + timedelta(days=1)
        except (ValueError, OverflowError):
            raise CommandError("Укажите корректные даты YYYY-MM-DD: start не позже end.") from None
        region = ZoneInfo("Asia/Yekaterinburg")
        lower = datetime.combine(start, time.min, tzinfo=region)
        upper = datetime.combine(next_day, time.min, tzinfo=region)
        leads = Lead.objects.filter(created_at__gte=lower, created_at__lt=upper)
        notifications = TelegramNotification.objects.filter(lead__in=leads)

        def grouped(queryset, field):
            # Explicit order clears model ordering; one count per group.
            return [
                {"value": row[field], "count": row["count"]}
                for row in queryset.order_by(field).values(field).annotate(count=Count("pk"))
            ]

        total = leads.count()
        report = {
            "schema": "lead-aggregates-v1",
            "period": {"start": start.isoformat(), "end": end.isoformat(), "timezone": str(region)},
            "test_leads": "included; no reliable test marker exists",
            "leads": total,
            "by_status": grouped(leads, "status"),
            "by_program": grouped(leads, "offering__slug"),
            "telegram": {
                "by_status": grouped(notifications, "status"),
                "without_notification": total - notifications.count(),
            },
            "notes": [
                "Counts describe saved leads, not unique customers or paid orders.",
                "Statuses and notification states are current, not historical snapshots.",
                "Do not compare directly with analytics event counts; use visits with goals.",
            ],
        }
        self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
