"""Application-side checks for the headers supplied by deploy/nginx/mu56.conf."""
from io import StringIO
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Lead, TelegramNotification


@override_settings(
    DEBUG=False,
    ALLOWED_HOSTS=["mu56.ru"],
    CSRF_TRUSTED_ORIGINS=["https://mu56.ru"],
    SECURE_SSL_REDIRECT=True,
    SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
    CSRF_COOKIE_SECURE=True,
    SESSION_COOKIE_SECURE=True,
    REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1},
    TELEGRAM_ENABLED=False,
)
class ProductionProxyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalog", stdout=StringIO())

    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.defaults.update(
            HTTP_HOST="mu56.ru", HTTP_X_FORWARDED_PROTO="https",
            HTTP_X_FORWARDED_FOR="192.0.2.10", REMOTE_ADDR="127.0.0.1",
        )
        self.payload = {"name": "Production QA", "phone": "+79031112233", "data_consent": True}

    def token(self):
        response = self.client.get("/api/v1/csrf/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.cookies[settings.CSRF_COOKIE_NAME]["secure"])
        return response.json()["csrf_token"]

    def test_http_redirects_but_trusted_https_catalogue_does_not(self):
        plain = self.client.get("/api/v1/characters/", HTTP_X_FORWARDED_PROTO="http")
        self.assertEqual(plain.status_code, 301)
        self.assertEqual(plain["Location"], "https://mu56.ru/api/v1/characters/")
        secure = self.client.get("/api/v1/characters/")
        self.assertEqual(secure.status_code, 200)
        self.assertTrue(secure.json()["next"].startswith("https://mu56.ru/"))

    def test_unknown_host_is_rejected(self):
        self.assertEqual(self.client.get("/api/v1/csrf/", HTTP_HOST="evil.example").status_code, 400)

    def test_https_form_saves_once_without_network_delivery(self):
        token = self.token()
        with patch("leads.notifications.bot_request") as send:
            response = self.client.post("/api/v1/leads/", self.payload, format="json",
                                        HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://mu56.ru")
            send.assert_not_called()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Lead.objects.count(), 1)
        self.assertEqual(TelegramNotification.objects.count(), 1)

    def test_missing_csrf_and_foreign_origin_do_not_create_leads(self):
        self.assertEqual(self.client.post("/api/v1/leads/", self.payload, format="json").status_code, 403)
        token = self.token()
        response = self.client.post("/api/v1/leads/", self.payload, format="json",
                                    HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://evil.example")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Lead.objects.count(), 0)

    def test_throttle_uses_client_ip_instead_of_combining_all_proxy_clients(self):
        token = self.token()
        for _ in range(10):
            response = self.client.post("/api/v1/leads/", self.payload, format="json",
                                        HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://mu56.ru")
            self.assertEqual(response.status_code, 201)
        blocked = self.client.post("/api/v1/leads/", self.payload, format="json",
                                   HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://mu56.ru")
        self.assertEqual(blocked.status_code, 429)
        other = self.client.post("/api/v1/leads/", self.payload, format="json",
                                 HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://mu56.ru",
                                 HTTP_X_FORWARDED_FOR="192.0.2.11")
        self.assertEqual(other.status_code, 201)
