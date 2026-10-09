import json
from datetime import datetime, timezone
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from leads.models import Lead, TelegramNotification


class LeadReportTests(TestCase):
    def create_at(self, timestamp, status=Lead.Status.NEW):
        lead = Lead.objects.create(
            name="Private client", phone="+79031112233", comment="Private wishes",
            location="Private address", manager_notes="Private note", status=status,
            consent_at=datetime.now(timezone.utc), consent_version="test",
        )
        Lead.objects.filter(pk=lead.pk).update(created_at=datetime.fromisoformat(timestamp))
        return lead

    def test_orenburg_day_boundaries_counts_and_privacy(self):
        self.create_at("2026-10-08T18:59:59+00:00")
        first = self.create_at("2026-10-08T19:00:00+00:00")
        self.create_at("2026-10-09T18:59:59+00:00", Lead.Status.CONFIRMED)
        self.create_at("2026-10-09T19:00:00+00:00")
        TelegramNotification.objects.create(lead=first, status=TelegramNotification.Status.SENT)
        output = StringIO()
        call_command("report_leads", start="2026-10-09", end="2026-10-09", stdout=output)
        raw = output.getvalue()
        report = json.loads(raw)
        self.assertEqual(report["leads"], 2)
        self.assertEqual(report["by_program"], [{"value": None, "count": 2}])
        self.assertEqual(report["by_status"], [{"value": "confirmed", "count": 1}, {"value": "new", "count": 1}])
        self.assertEqual(report["telegram"]["without_notification"], 1)
        self.assertEqual(report["telegram"]["by_status"], [{"value": "sent", "count": 1}])
        for private in ["Private", "+79031112233", str(first.pk)]:
            self.assertNotIn(private, raw)
        self.assertEqual(Lead.objects.count(), 4)
        self.assertEqual(TelegramNotification.objects.get(lead=first).attempts, 0)

    def test_invalid_period_and_empty_result(self):
        for start, end in [("wrong", "2026-10-09"), ("2026-10-10", "2026-10-09"), ("2026-10-09", "9999-12-31")]:
            with self.subTest(start=start, end=end), self.assertRaises(CommandError):
                call_command("report_leads", start=start, end=end, stdout=StringIO())
        output = StringIO()
        call_command("report_leads", start="2026-10-09", end="2026-10-09", stdout=output)
        self.assertEqual(json.loads(output.getvalue())["leads"], 0)
