"""Ubuntu container acceptance drill. Never use against a production database."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import pwd
import secrets
import signal
import ssl
import subprocess
import sys
import time
from urllib.parse import quote

import psycopg

if sys.platform != "linux" or os.environ.get("PGHOST") != "database" or os.environ.get("PGDATABASE") != "mu56_qa":
    raise SystemExit("Run only inside deploy/qa/compose.yml.")
ROOT = Path("/app")
PYTHON = ROOT / ".venv/bin/python"
shared = Path("/srv/mu56/shared")
owner = pwd.getpwnam("mu56")
for directory in (shared / "media", shared / "static", shared / "private-cache", shared / "next-cache", Path("/srv/mu56/backups")):
    directory.mkdir(parents=True, exist_ok=True, mode=0o750)
    os.chown(directory, owner.pw_uid, owner.pw_gid)
    if directory.name in {"private-cache", "next-cache", "backups"}:
        directory.chmod(0o700)

password = secrets.token_urlsafe(24)
with psycopg.connect(host="database", dbname="mu56_qa", user="qa_bootstrap", password="isolated-qa-only-not-production", autocommit=True) as database:
    if database.execute("SELECT 1 FROM pg_roles WHERE rolname='mu56'").fetchone():
        raise RuntimeError("QA database already initialized. Use a new isolated Compose project.")
    from psycopg import sql
    database.execute(sql.SQL("CREATE ROLE mu56 LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE").format(sql.Literal(password)))
    database.execute("ALTER DATABASE mu56_qa OWNER TO mu56")

backend_env = {**os.environ, "DJANGO_SETTINGS_MODULE": "config.production", "DJANGO_DEBUG": "0",
               "HOME": owner.pw_dir,
               "DJANGO_SECRET_KEY": secrets.token_urlsafe(60), "DJANGO_ALLOWED_HOSTS": "mu56.ru",
               "DJANGO_CSRF_TRUSTED_ORIGINS": "https://mu56.ru", "PGUSER": "mu56", "PGPASSWORD": password,
               "DJANGO_STATIC_ROOT": str(shared / "static"), "DJANGO_MEDIA_ROOT": str(shared / "media"),
               "DJANGO_CACHE_ROOT": str(shared / "private-cache"), "TELEGRAM_ENABLED": "0",
               "TELEGRAM_BOT_TOKEN": "", "TELEGRAM_CHAT_ID": ""}
frontend_env = {"PATH": os.environ["PATH"], "HOME": owner.pw_dir, "LANG": "C.UTF-8",
                "NODE_ENV": "production", "BACKEND_ORIGIN": "http://127.0.0.1:8081",
                "SITE_URL": "https://mu56.ru", "SITE_INDEXING_ENABLED": "false", "NEXT_TELEMETRY_DISABLED": "1"}


def manage(*args):
    subprocess.run([str(PYTHON), "manage.py", *args], cwd=ROOT / "backend", env=backend_env,
                   user=owner.pw_uid, group=owner.pw_gid, check=True, timeout=900)


manage("migrate", "--noinput")
manage("import_catalog", "/catalog", "--replace-migration-defaults")
manage("collectstatic", "--noinput")
manage("check", "--deploy", "--fail-level", "ERROR")

cert = Path("/etc/letsencrypt/live/mu56.ru")
cert.mkdir(parents=True)
subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=mu56.ru", "-addext", "subjectAltName=DNS:mu56.ru", "-keyout", str(cert / "privkey.pem"), "-out", str(cert / "fullchain.pem")], check=True, capture_output=True)
Path("/etc/nginx/sites-enabled/default").unlink(missing_ok=True)
Path("/etc/nginx/sites-enabled/mu56").write_text((ROOT / "deploy/nginx/mu56.conf").read_text())
subprocess.run(["nginx", "-t"], check=True)

processes = []
checks = []


def start(command, cwd, environment, unprivileged=True):
    permissions = {"user": owner.pw_uid, "group": owner.pw_gid, "extra_groups": [owner.pw_gid]} if unprivileged else {}
    process = subprocess.Popen(command, cwd=cwd, env=environment, start_new_session=True, **permissions)
    processes.append(process)
    return process


def request(path, method="GET", payload=None, headers=None, port=443):
    connection = http.client.HTTPSConnection("127.0.0.1", port, context=ssl._create_unverified_context(), timeout=30)
    connection.request(method, path, body=json.dumps(payload) if payload is not None else None,
                       headers={"Host": "mu56.ru", **(headers or {})})
    response = connection.getresponse()
    body = response.read()
    result = (response.status, dict(response.getheaders()), body)
    connection.close()
    return result


def require(condition, label):
    if not condition:
        raise RuntimeError("Acceptance failed: " + label)
    checks.append(label)
    print("PASS " + label, flush=True)


def wait_ready(path):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        if any(process.poll() is not None for process in processes):
            raise RuntimeError("A server exited before readiness.")
        try:
            if request(path)[0] == 200:
                return
        except (OSError, http.client.HTTPException):
            pass
        time.sleep(0.5)
    raise RuntimeError("Readiness timeout.")


try:
    gunicorn = start([str(ROOT / ".venv/bin/gunicorn"), "--config", str(ROOT / "deploy/gunicorn.conf.py"), "config.wsgi:application"], ROOT / "backend", backend_env)
    start(["nginx", "-g", "daemon off;"], ROOT, os.environ.copy(), unprivileged=False)
    wait_ready("/api/v1/characters/")
    subprocess.run(["pnpm", "build"], cwd=ROOT / "frontend", env=frontend_env,
                   user=owner.pw_uid, group=owner.pw_gid, check=True, timeout=900)
    cache = ROOT / "frontend/.next/cache"
    if cache.exists():
        cache.rename(ROOT / "frontend/.next/cache-build")
    cache.symlink_to(shared / "next-cache", target_is_directory=True)
    frontend = start(["node", "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"], ROOT / "frontend", frontend_env)
    wait_ready("/new-year")
    # Docker root lacks CAP_SYS_PTRACE for a process with another UID. Read as its owner.
    environment_reader = "import pathlib,sys,json; print(json.dumps([x.split(b'=',1)[0].decode() for x in pathlib.Path('/proc/'+sys.argv[1]+'/environ').read_bytes().split(b'\\0') if x]))"
    frontend_keys = set(json.loads(subprocess.check_output([str(PYTHON), "-c", environment_reader, str(frontend.pid)], user=owner.pw_uid, group=owner.pw_gid, env=frontend_env)))
    require(not frontend_keys.intersection({"PGPASSWORD", "DJANGO_SECRET_KEY", "TELEGRAM_BOT_TOKEN"}), "Frontend has no backend secrets")
    for path in ("/", "/new-year", "/characters/spider-man", "/transformers/bumblebee", "/packages", "/shows", "/articles", "/contacts"):
        status, headers, body = request(path)
        require(status == 200 and b"<h1" in body, "SSR " + path)
        require(b"noindex" in body, "QA noindex " + path)
    require(b"Disallow: /" in request("/robots.txt")[2], "QA robots")
    require(request("/admin/login/")[0] == 200, "Django admin through HTTPS")
    require(request("/static/admin/css/base.css")[0] == 200, "Admin static files")
    photo_manifest = json.loads(Path("/catalog/manifest.json").read_text())
    name = next(iter(photo_manifest["media"]))
    status, headers, body = request("/uploads/" + quote(name))
    require(status == 200 and hashlib.sha256(body).hexdigest() == photo_manifest["media"][name], "Imported photo through Nginx")
    status, headers, body = request("/_next/image?url=" + quote("/uploads/" + name, safe="") + "&w=640&q=75", headers={"Accept": "image/webp"})
    require(status == 200 and headers.get("Content-Type") == "image/webp", "Linux Next image optimization")
    status, headers, body = request("/api/v1/csrf/")
    token = json.loads(body)["csrf_token"]
    require(status == 200 and "Secure" in headers.get("Set-Cookie", ""), "Secure CSRF cookie")
    lead = {"name": "Linux QA — не настоящий заказ", "phone": "+79031112233", "data_consent": True, "consent_version": json.loads((Path(__file__).resolve().parents[1] / "frontend/src/lib/lead-consent.json").read_text(encoding="utf-8"))["version"],
            "offering": "new-year", "tariff_code": "minutes-50", "addons": ["nitrogen"],
            "comment": "Изолированный Linux-стенд. Не звонить, не бронировать."}
    csrf_headers = {"Content-Type": "application/json", "Cookie": "csrftoken=" + token,
                    "X-CSRFToken": token, "Origin": "https://mu56.ru"}
    csrf_headers["Cookie"] = headers["Set-Cookie"].split(";", 1)[0]
    require(request("/api/v1/leads/", "POST", lead, headers={"Content-Type": "application/json"})[0] == 403, "CSRF rejects missing token")
    require(request("/api/v1/leads/", "POST", lead, headers={**csrf_headers, "Origin": "https://evil.example"})[0] == 403, "CSRF rejects foreign origin")
    require(request("/api/v1/leads/", "POST", lead, headers=csrf_headers)[0] == 201, "HTTPS lead creation")
    with psycopg.connect(host="database", dbname="mu56_qa", user="mu56", password=password) as database:
        records = database.execute("SELECT selection_snapshot FROM leads_lead").fetchall()
        require(len(records) == 1 and records[0][0]["known_program_amount_rub"] == 12400, "Persisted New Year plus nitrogen = 12400")
        require(database.execute("SELECT count(*) FROM auth_user").fetchone()[0] == 0, "No local admin users imported")
        require(database.execute("SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user").fetchone() == (False, False, False), "Restricted application DB role")
    manage("backup_site", "/srv/mu56/backups")
    require(any(Path("/srv/mu56/backups").glob("*/manifest.json")), "Linux private data backup")
    backup = next(Path("/srv/mu56/backups").iterdir())
    backup_manifest = json.loads((backup / "manifest.json").read_text())
    with psycopg.connect(host="database", dbname="mu56_qa", user="qa_bootstrap", password="isolated-qa-only-not-production", autocommit=True) as database:
        database.execute("CREATE DATABASE mu56_restore_qa OWNER mu56")
    subprocess.run(["pg_restore", "-w", "--exit-on-error", "--no-owner", "--no-acl", "-d", "mu56_restore_qa", str(backup / "database.dump")], env=backend_env, user=owner.pw_uid, group=owner.pw_gid, check=True, timeout=300)
    with psycopg.connect(host="database", dbname="mu56_restore_qa", user="mu56", password=password) as database:
        tables = database.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").fetchall()
        counts = {name: database.execute(sql.SQL("SELECT count(*) FROM public.{}").format(sql.Identifier(name))).fetchone()[0] for (name,) in tables}
        require(counts == backup_manifest["table_counts"], "Linux restore matches all snapshot table counts")
    Path("/report/data-backup-manifest.json").write_text(json.dumps(backup_manifest, indent=2), encoding="utf-8")
    # Restart actual app processes; data and imported photos remain outside the build.
    for process in (frontend, gunicorn):
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=45)
        processes.remove(process)
    gunicorn = start([str(ROOT / ".venv/bin/gunicorn"), "--config", str(ROOT / "deploy/gunicorn.conf.py"), "config.wsgi:application"], ROOT / "backend", backend_env)
    frontend = start(["node", "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"], ROOT / "frontend", frontend_env)
    wait_ready("/new-year")
    require(request("/uploads/" + quote(name))[0] == 200, "Media survives app restart")
    with psycopg.connect(host="database", dbname="mu56_qa", user="mu56", password=password) as database:
        postgres_version = database.info.server_version
        require(database.execute("SELECT count(*) FROM leads_lead").fetchone()[0] == 1, "Lead survives app restart")
    report = {"verified": True, "checks": checks, "telegram_enabled": False, "systemd_started": False,
              "python": sys.version.split()[0], "node": subprocess.check_output(["node", "--version"], text=True).strip(),
              "postgres": postgres_version, "self_signed_tls": True}
    Path("/report/linux-stack.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Linux acceptance complete: {len(checks)} checks. No Telegram worker started.", flush=True)
    if os.environ.get("QA_KEEP_RUNNING") == "1":
        print("QA remains on https://127.0.0.1:18444 (requires Host mu56.ru).", flush=True)
        while True:
            time.sleep(10)
finally:
    for process in reversed(processes):
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=45)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
