from django.conf import settings
from datetime import timedelta
from io import StringIO

from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from catalog.models import Offering
from .models import Lead, TelegramNotification
from .serializers import LeadCreateSerializer
from .forms import LeadAdminForm
from catalog.models import Character


@override_settings(TELEGRAM_ENABLED=False)
class LeadWorkflowAdminTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalog", stdout=StringIO())
        cls.admin_user = get_user_model().objects.create_superuser(username="workflow-admin", password=None)

    def setUp(self):
        self.client.force_login(self.admin_user)
        serializer = LeadCreateSerializer(data={"name": "Клиент рабочего процесса", "phone": "+79031112233", "offering": "full-party", "comment": "Выпускной", "data_consent": True, "consent_version": settings.LEAD_CONSENT_VERSION})
        serializer.is_valid(raise_exception=True)
        self.lead = serializer.save()
        self.url = f"/admin/leads/lead/{self.lead.pk}/change/"

    def test_status_actions_record_history_without_changing_prices_or_delivery(self):
        snapshot = self.lead.selection_snapshot
        TelegramNotification.objects.filter(lead=self.lead).update(status="sent", message_id=42)
        for action, status in [("mark_contacted", "contacted"), ("mark_proposal", "proposal"), ("mark_confirmed", "confirmed"), ("mark_cancelled", "cancelled")]:
            response = self.client.post("/admin/leads/lead/", {"action": action, "_selected_action": [str(self.lead.pk)]})
            self.assertEqual(response.status_code, 302)
            self.lead.refresh_from_db()
            self.assertEqual(self.lead.status, status)
            self.assertEqual(self.lead.selection_snapshot, snapshot)
            self.assertEqual(self.lead.telegram_notification.status, "sent")
            self.assertEqual(self.lead.telegram_notification.message_id, 42)
        self.assertEqual(LogEntry.objects.filter(object_id=str(self.lead.pk), user=self.admin_user).count(), 4)

    def test_dynamic_hero_choices_match_form_and_do_not_change_lead(self):
        snapshot = self.lead.selection_snapshot
        for slug in ["bumblebee", "full-party", "new-year-duo"]:
            offering = Offering.objects.filter(slug=slug).first()
            if not offering:
                offering = Offering.objects.get(kind="seasonal")
            response = self.client.get("/admin/leads/lead/character-choices/", {"offering": offering.pk})
            self.assertEqual(response.status_code, 200)
            self.assertIn("no-store", response["Cache-Control"])
            ids = {item["id"] for item in response.json()["choices"]}
            form = LeadAdminForm(data={"offering": str(offering.pk)}, instance=self.lead)
            self.assertEqual(ids, set(form.fields["character"].queryset.values_list("pk", flat=True)))
            if slug == "bumblebee":
                self.assertFalse(ids & set(Character.objects.filter(slug__in=["bumblebee", "optimus-prime", "iron-man"]).values_list("pk", flat=True)))
                self.assertEqual(response.json()["primary_hero"], "Бамблби")
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.offering.slug, "full-party")
        self.assertEqual(self.lead.selection_snapshot, snapshot)
        self.assertEqual(TelegramNotification.objects.count(), 1)
        self.assertFalse(LogEntry.objects.exists())
        self.assertContains(self.client.get(self.url), "leads/admin-selection.js")

    def test_hero_choices_reject_bad_ids_and_writes(self):
        for value in ["bad", "99999999999999999999", "²", "9999999"]:
            self.assertEqual(self.client.get("/admin/leads/lead/character-choices/", {"offering": value}).status_code, 400)
        self.assertEqual(self.client.post("/admin/leads/lead/character-choices/").status_code, 405)

    def test_hero_choices_require_staff_change_permission(self):
        self.client.logout()
        self.assertEqual(self.client.get("/admin/leads/lead/character-choices/").status_code, 302)
        viewer = get_user_model().objects.create_user(username="hero-viewer", is_staff=True)
        viewer.user_permissions.add(Permission.objects.get(codename="view_lead"))
        self.client.force_login(viewer)
        self.assertEqual(self.client.get("/admin/leads/lead/character-choices/").status_code, 403)

    def test_work_filters_and_internal_note_search(self):
        self.lead.manager_notes = "Перезвонить в пятницу"
        self.lead.save(update_fields=["manager_notes"])
        response = self.client.get("/admin/leads/lead/?work=new")
        self.assertContains(response, self.lead.name)
        self.assertContains(self.client.get("/admin/leads/lead/?q=пятницу"), self.lead.name)
        Lead.objects.filter(pk=self.lead.pk).update(status="confirmed")
        self.assertNotContains(self.client.get("/admin/leads/lead/?work=open"), self.lead.name)
        self.assertContains(self.client.get("/admin/leads/lead/?work=closed"), self.lead.name)

    def test_snapshot_uses_original_amount_and_escapes_client_text(self):
        self.lead.selection_snapshot["offering"]["name"] = '<script>alert("test")</script>'
        self.lead.save(update_fields=["selection_snapshot"])
        Offering.objects.get(slug="full-party").prices.filter(context="base").update(amount_rub=99999)
        page = self.client.get(self.url)
        self.assertContains(page, "9 400 ₽")
        self.assertNotContains(page, "99 999 ₽")
        self.assertContains(page, "&lt;script&gt;")
        self.assertNotContains(page, '<script>alert("test")</script>')
        self.assertContains(page, "tel:+79031112233")

    def test_card_saves_manager_notes_without_mutating_snapshot(self):
        snapshot = self.lead.selection_snapshot
        notification = self.lead.telegram_notification
        payload = {
            "name": self.lead.name, "phone": self.lead.phone, "contact_method": "phone",
            "status": "proposal", "offering": self.lead.offering_id,
            "manager_notes": "Согласовать площадку и выезд", "location": "Школа",
            "event_date": str(timezone.localdate() + timedelta(days=10)), "event_time": "12:00",
            "comment": self.lead.comment, "child_age": "7", "children_count": "30",
            "telegram_notification-TOTAL_FORMS": "1", "telegram_notification-INITIAL_FORMS": "1",
            "telegram_notification-MIN_NUM_FORMS": "0", "telegram_notification-MAX_NUM_FORMS": "1",
            "telegram_notification-0-id": str(notification.pk), "telegram_notification-0-lead": str(self.lead.pk),
            "_save": "Сохранить",
        }
        response = self.client.post(self.url, payload)
        self.assertEqual(response.status_code, 302)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.manager_notes, payload["manager_notes"])
        self.assertEqual(self.lead.status, "proposal")
        self.assertEqual(self.lead.event_time.hour, 12)
        self.assertEqual(self.lead.selection_snapshot, snapshot)
        self.assertEqual(TelegramNotification.objects.filter(lead=self.lead).count(), 1)

    def test_view_only_staff_cannot_run_status_actions(self):
        viewer = get_user_model().objects.create_user(username="workflow-viewer", is_staff=True)
        viewer.user_permissions.add(Permission.objects.get(codename="view_lead"))
        self.client.force_login(viewer)
        response = self.client.post("/admin/leads/lead/", {"action": "mark_confirmed", "_selected_action": [str(self.lead.pk)]})
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, "new")
        self.assertNotIn(response.status_code, [500])
        page = self.client.get(self.url)
        self.assertContains(page, "Внутренние заметки")
        self.assertNotContains(page, 'name="_save"')

    def test_admin_prevents_large_hero_in_package_or_as_transformer_partner(self):
        for program, hero in [("full-party", "bumblebee"), ("bumblebee", "bumblebee"), ("bumblebee", "optimus-prime"), ("optimus-prime", "iron-man")]:
            form = LeadAdminForm(instance=self.lead, data={"phone": self.lead.phone, "contact_method": "phone", "status": "new", "offering": str(Offering.objects.get(slug=program).pk), "character": str(Character.objects.get(slug=hero).pk)})
            self.assertFalse(form.is_valid())
            self.assertIn("character", form.errors)
        form = LeadAdminForm(instance=self.lead, data={"phone": self.lead.phone, "contact_method": "phone", "status": "new", "offering": str(Offering.objects.get(slug="bumblebee").pk), "character": str(Character.objects.get(slug="spider-man").pk)})
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.fields["character"].label, "Второй герой (обычный костюм)")
        self.assertNotIn("optimus-prime", list(form.fields["character"].queryset.values_list("slug", flat=True)))
