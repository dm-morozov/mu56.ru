"""Generate new private staging settings. Never overwrites existing credentials."""
import argparse
from pathlib import Path
import secrets

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("directory", type=Path)
parser.add_argument("--host", required=True)
args = parser.parse_args()
if not all(c.isalnum() or c in ".-" for c in args.host) or "." not in args.host:
    parser.error("Use a hostname without scheme, path or port")
root = args.directory.resolve()
root.mkdir(parents=True, exist_ok=True, mode=0o700)
names = ["database.env", "backend.env", "frontend.env", "bootstrap-role.sql"]
if any((root / name).exists() for name in names):
    parser.error("Private settings already exist; refusing to overwrite")
bootstrap_password = secrets.token_urlsafe(48)
app_password = secrets.token_urlsafe(48)
files = {
    "database.env": f"POSTGRES_USER=bootstrap\nPOSTGRES_DB=mu56\nPOSTGRES_PASSWORD={bootstrap_password}\n",
    "backend.env": f"""DJANGO_SETTINGS_MODULE=config.production
DJANGO_DEBUG=0
DJANGO_SECRET_KEY={secrets.token_urlsafe(64)}
DJANGO_ALLOWED_HOSTS={args.host}
DJANGO_CSRF_TRUSTED_ORIGINS=https://{args.host}
PGHOST=database
PGPORT=5432
PGDATABASE=mu56
PGUSER=mu56
PGPASSWORD={app_password}
DJANGO_STATIC_ROOT=/srv/mu56/shared/static
DJANGO_MEDIA_ROOT=/srv/mu56/shared/media
DJANGO_CACHE_ROOT=/srv/mu56/shared/private-cache
TELEGRAM_ENABLED=0
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
""",
    "frontend.env": f"NODE_ENV=production\nBACKEND_ORIGIN=http://127.0.0.1:8081\nSITE_URL=https://{args.host}\nSITE_INDEXING_ENABLED=false\n",
    "bootstrap-role.sql": f"CREATE ROLE mu56 LOGIN PASSWORD '{app_password}' NOSUPERUSER NOCREATEDB NOCREATEROLE;\nALTER DATABASE mu56 OWNER TO mu56;\n",
}
for name, body in files.items():
    path = root / name
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(body)
    path.chmod(0o600)
print("Private settings created; no credentials printed. Telegram and indexing disabled.")
