"""Local development first; production requires explicit environment settings."""
import os
import json
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("Set DJANGO_SECRET_KEY for production.")
    SECRET_KEY = "development-only-mu56-do-not-use-in-production"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]").split(",")
INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "rest_framework", "catalog", "leads",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [], "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"

if os.environ.get("DJANGO_USE_SQLITE") == "1":
    if not DEBUG:
        raise ImproperlyConfigured("SQLite is only allowed for local development/tests.")
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "local.sqlite3"}}
else:
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("PGDATABASE", "mu56"),
        "USER": os.environ.get("PGUSER", "mu56"),
        "PASSWORD": os.environ.get("PGPASSWORD", ""),
        "HOST": os.environ.get("PGHOST", "127.0.0.1"),
        "PORT": os.environ.get("PGPORT", "5432"),
    }}
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Asia/Yekaterinburg"  # Event dates in Orenburg.
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/uploads/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 24,
    "DEFAULT_THROTTLE_RATES": {"lead_create": "10/hour"},
    "NUM_PROXIES": 0,  # Configure deliberately alongside the trusted reverse proxy.
}
DATA_UPLOAD_MAX_MEMORY_SIZE = 64 * 1024
LEAD_CONSENT_VERSION = "draft-v1"  # Replace with the actual published text version before launch.
CSRF_FAILURE_VIEW = "leads.views.csrf_failure"
CSRF_TRUSTED_ORIGINS = os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000" if DEBUG else "").split(",") if DEBUG or os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS") else []
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True

# Local credentials stay outside Git. Production uses environment variables only.
telegram_local = {}
telegram_file = BASE_DIR.parent / ".local" / "telegram.json"
if DEBUG and telegram_file.exists():
    try:
        telegram_local = json.loads(telegram_file.read_text(encoding="utf-8"))
        if not isinstance(telegram_local, dict):
            raise ValueError
    except (ValueError, OSError):
        raise ImproperlyConfigured("Invalid local Telegram configuration.") from None
TELEGRAM_ENABLED = os.environ.get("TELEGRAM_ENABLED", str(telegram_local.get("enabled", False))).lower() in {"1", "true"}
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", telegram_local.get("bot_token", ""))
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", str(telegram_local.get("chat_id", "")))
if TELEGRAM_ENABLED and (not isinstance(TELEGRAM_BOT_TOKEN, str) or not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID.isdecimal() or int(TELEGRAM_CHAT_ID) <= 0):
    raise ImproperlyConfigured("Telegram requires a bot token and a positive private chat ID.")
