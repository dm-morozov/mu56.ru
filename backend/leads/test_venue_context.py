from unittest.mock import patch

from django.conf import settings
from django.contrib.admin import site
from django.test import TestCase, override_settings

from .admin import LeadAdmin
from .models import Lead, TelegramNotification
from .serializers import LeadCreateSerializer
from .telegram import notification_payload


@override_settings(TELEGRAM_ENABLED=False)
class VenueContextTests(TestCase):
    def setUp(self):
        self.sender = patch("leads.notifications.bot_request").start()
        self.addCleanup(patch.stopall)
        self.addCleanup(self.sender.assert_not_called)

    def serializer(self, **values):
        return LeadCreateSerializer(data={
            "phone": "+79000000000", "data_consent": True,
            "consent_version": settings.LEAD_CONSENT_VERSION, **values,
        })

    def create(self, **values):
        serializer = self.serializer(**values)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def test_known_venue_survives_database_reload_and_is_interest(self):
        lead = self.create(venue="vinni-puh", location="Место клиента")
        lead.refresh_from_db()
        self.assertEqual(lead.location, "Место клиента")
        self.assertEqual(lead.selection_snapshot["venue"], {
            "slug": "vinni-puh", "name": "Винни-Пух", "status": "interest",
        })
        self.assertEqual(lead.status, Lead.Status.NEW)
        self.assertTrue(lead.selection_snapshot["requires_manager_confirmation"])
        self.assertEqual(lead.telegram_notification.status, TelegramNotification.Status.PENDING)

    def test_unknown_venue_rejected_without_lead_or_queue(self):
        serializer = self.serializer(venue="unknown")
        self.assertFalse(serializer.is_valid())
        self.assertIn("venue", serializer.errors)
        self.assertFalse(Lead.objects.exists())
        self.assertFalse(TelegramNotification.objects.exists())

    def test_client_cannot_supply_venue_name_or_object(self):
        for values in ({"venue": {"slug": "vinni-puh", "name": "Бронь подтверждена"}},
                       {"venue": "vinni-puh", "venue_name": "Бронь подтверждена"}):
            with self.subTest(values=values):
                serializer = self.serializer(**values)
                self.assertFalse(serializer.is_valid())

    def test_omitted_or_blank_venue_keeps_old_contract(self):
        for values in ({}, {"venue": ""}):
            with self.subTest(values=values):
                lead = self.create(**values)
                self.assertNotIn("venue", lead.selection_snapshot)
                self.assertEqual(lead.venue_interest, "")
                self.assertNotIn("Интерес к площадке", notification_payload(lead, "1")["text"])

    def test_admin_and_notification_explain_unconfirmed_interest(self):
        lead = self.create(venue="vinni-puh")
        for text in (str(LeadAdmin(Lead, site).snapshot_summary(lead)),
                     notification_payload(lead, "1")["text"]):
            self.assertIn("Интерес к площадке: Винни-Пух", text)
            self.assertIn("бронь не подтверждена", text)

    def test_readers_ignore_arbitrary_snapshot_name(self):
        lead = self.create(venue="vinni-puh")
        lead.selection_snapshot["venue"]["name"] = "Бронь подтверждена"
        self.assertEqual(lead.venue_interest, "Винни-Пух")
        self.assertNotIn("Бронь подтверждена", notification_payload(lead, "1")["text"])
        lead.selection_snapshot["venue"]["slug"] = "unknown"
        self.assertEqual(lead.venue_interest, "")
