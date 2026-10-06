"""Single-host production behind the loopback-only Nginx configuration in deploy/."""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

if os.environ.get("DJANGO_DEBUG") != "0":
    raise ImproperlyConfigured("Production requires DJANGO_DEBUG=0.")

from .settings import *  # noqa: F403,E402


def required(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"Set {name} for production.")
    return value


if len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5 or SECRET_KEY.startswith("development-only"):
    raise ImproperlyConfigured("Production requires a random DJANGO_SECRET_KEY of at least 50 characters.")
ALLOWED_HOSTS = [host.strip() for host in required("DJANGO_ALLOWED_HOSTS").split(",")]
if any(not host or "*" in host or host.startswith(".") for host in ALLOWED_HOSTS):
    raise ImproperlyConfigured("Use explicit DJANGO_ALLOWED_HOSTS, without a wildcard.")
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in required("DJANGO_CSRF_TRUSTED_ORIGINS").split(",")]
if any(not origin.startswith("https://") or "*" in origin for origin in CSRF_TRUSTED_ORIGINS):
    raise ImproperlyConfigured("Production CSRF origins must be explicit HTTPS origins.")
for name in ("PGDATABASE", "PGUSER", "PGPASSWORD", "PGHOST", "PGPORT"):
    required(name)


def storage_path(name):
    path = Path(required(name))
    if not path.is_absolute():
        raise ImproperlyConfigured(f"{name} must be an absolute persistent path.")
    return path


STATIC_ROOT = storage_path("DJANGO_STATIC_ROOT")
STATIC_URL = "/static/"
MEDIA_ROOT = storage_path("DJANGO_MEDIA_ROOT")
CACHE_ROOT = storage_path("DJANGO_CACHE_ROOT")
paths = (STATIC_ROOT, MEDIA_ROOT, CACHE_ROOT)
if any(a == b or a in b.parents or b in a.parents for i, a in enumerate(paths) for b in paths[i + 1:]):
    raise ImproperlyConfigured("Static, media and private cache paths must be separate.")
CACHES = {"default": {
    "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
    "LOCATION": str(CACHE_ROOT),
    "OPTIONS": {"MAX_ENTRIES": 10000},
}}
# Nginx overwrites these headers. Gunicorn must remain bound to 127.0.0.1.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
REST_FRAMEWORK = {**REST_FRAMEWORK, "NUM_PROXIES": 1}
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
