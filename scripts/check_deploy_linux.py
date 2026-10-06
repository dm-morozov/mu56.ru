"""Validate deploy templates with isolated Nginx listeners and dummy upstreams.

Linux only. No system service, DNS, real certificate or Telegram configuration is changed.
"""
import argparse
import gzip
import http.client
import json
from pathlib import Path
import shutil
import socket
import ssl
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

parser = argparse.ArgumentParser()
parser.add_argument("--nginx", required=True, type=Path)
parser.add_argument("--mime-types", required=True, type=Path)
parser.add_argument("--skip-systemd", action="store_true", help="Run only Nginx checks in containers without systemd-analyze.")
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
seen = []


class Upstream(BaseHTTPRequestHandler):
    def log_message(self, *unused):
        pass

    def respond(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        item = {"path": self.path, "method": self.command,
                "host": self.headers.get("Host"), "proto": self.headers.get("X-Forwarded-Proto"),
                "ip": self.headers.get("X-Forwarded-For")}
        seen.append(item)
        body = json.dumps(item).encode()
        self.send_response(404 if self.path.endswith("missing.js") else 200)
        if self.path.startswith("/_next/static/"):
            body = b"/* static fixture */\n" * 300
            self.send_header("Content-Type", "application/javascript")
        else:
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = respond
    do_POST = respond


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


with tempfile.TemporaryDirectory(prefix="mu56-nginx-qa-") as folder:
    qa = Path(folder)
    qa.chmod(0o755)  # Nginx's unprivileged worker must read the fixture media.
    for name in ("static", "media", "logs", "body", "proxy", "fastcgi", "uwsgi", "scgi"):
        (qa / name).mkdir()
    (qa / "static" / "admin.css").write_text("/* fixture */")
    (qa / "media" / "clip.mp4").write_bytes(bytes(range(100)))
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
                    "-subj", "/CN=mu56.ru", "-addext", "subjectAltName=DNS:mu56.ru,IP:127.0.0.1",
                    "-keyout", str(qa / "key.pem"), "-out", str(qa / "cert.pem")],
                   check=True, capture_output=True, timeout=30)
    template = (repo / "deploy/nginx/mu56.conf").read_text()
    replacements = {
        "listen 80;": "listen 127.0.0.1:18080;",
        "listen 443 ssl http2;": "listen 127.0.0.1:18443 ssl http2;",
        "127.0.0.1:8081": "127.0.0.1:18081",
        "127.0.0.1:8000": "127.0.0.1:18000",
        "127.0.0.1:3000": "127.0.0.1:13000",
        "/etc/letsencrypt/live/mu56.ru/fullchain.pem": str(qa / "cert.pem"),
        "/etc/letsencrypt/live/mu56.ru/privkey.pem": str(qa / "key.pem"),
        "/srv/mu56/shared/static/": str(qa / "static") + "/",
        "/srv/mu56/shared/media/": str(qa / "media") + "/",
        "/var/log/nginx/": str(qa / "logs") + "/",
    }
    for source, destination in replacements.items():
        template = template.replace(source, destination)
    config = qa / "nginx.conf"
    config.write_text(
        f"pid {qa}/nginx.pid;\nerror_log {qa}/logs/main.log;\n"
        f"events {{ worker_connections 128; }}\nhttp {{\naccess_log off;\ninclude {args.mime_types};\n"
        f"client_body_temp_path {qa}/body;\nproxy_temp_path {qa}/proxy;\n"
        f"fastcgi_temp_path {qa}/fastcgi;\nuwsgi_temp_path {qa}/uwsgi;\nscgi_temp_path {qa}/scgi;\n"
        + template + "\n}\n"
    )
    validation = subprocess.run([str(args.nginx), "-t", "-e", str(qa / "logs/main.log"), "-p", str(qa), "-c", str(config)],
                                capture_output=True, text=True, timeout=20)
    require(validation.returncode == 0, "Nginx syntax: " + validation.stderr)
    servers = [ThreadingHTTPServer(("127.0.0.1", port), Upstream) for port in (18000, 13000)]
    for server in servers:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    process = subprocess.Popen([str(args.nginx), "-e", str(qa / "logs/main.log"), "-p", str(qa), "-c", str(config), "-g", "daemon off;"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    context = ssl.create_default_context(cafile=str(qa / "cert.pem"))

    def request(path, *, port=18443, method="GET", body=None, headers=None):
        connection = (http.client.HTTPSConnection("127.0.0.1", port, context=context, timeout=5)
                      if port == 18443 else http.client.HTTPConnection("127.0.0.1", port, timeout=5))
        try:
            connection.request(method, path, body=body, headers={"Host": "mu56.ru", **(headers or {})})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    try:
        for _ in range(50):
            if process.poll() is not None:
                raise RuntimeError("Nginx stopped before validation.")
            try:
                request("/", port=18080)
                break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError("Nginx did not become ready.")
        status, headers, _ = request("/new-year?qa=1", port=18080)
        require(status == 308 and headers["Location"] == "https://mu56.ru/new-year?qa=1", "HTTP redirect")
        status, _, body = request("/api/v1/csrf/", headers={"X-Forwarded-Proto": "http", "X-Forwarded-For": "198.51.100.23"})
        item = json.loads(body)
        require(status == 200 and item["proto"] == "https" and item["ip"] == "127.0.0.1" and item["host"] == "mu56.ru", "Trusted headers overwrite")
        require(request("/api/v1/leads/", method="POST", body=b"{}", headers={"Content-Type": "application/json"})[0] == 200, "Lead POST forwarding")
        require(request("/api/v1/leads/", method="POST", body=b"x" * 65537)[0] == 413, "Lead size limit")
        require(request("/admin/")[0] == 200, "Admin forwarding")
        require(request("/static/admin.css")[2] == b"/* fixture */", "Admin static files")
        status, headers, body = request("/uploads/clip.mp4", headers={"Range": "bytes=10-19"})
        require(status == 206 and body == bytes(range(10, 20)) and headers["Content-Type"] == "video/mp4", "Video range requests")
        require(request("/uploads/missing.jpg")[0] == 404, "Missing media")
        require(request("/health/")[0] == 404, "Public health protection")
        status, _, body = request("/api/v1/characters/", port=18081)
        require(status == 200 and json.loads(body)["proto"] == "https", "Internal catalogue")
        require(request("/api/v1/leads/", port=18081, method="POST", body=b"{}")[0] == 403, "Internal POST blocked")
        require(request("/admin/", port=18081)[0] == 404, "Internal admin blocked")
        require(request("/uploads/clip.mp4", port=18081)[2] == bytes(range(100)), "Internal image/media fetch")
        require(request("/new-year")[0] == 200, "Frontend forwarding")
        status, headers, compressed = request("/_next/static/chunks/test.js", headers={"Accept-Encoding": "gzip"})
        require(status == 200 and headers.get("Content-Encoding") == "gzip", "Static JavaScript compression")
        require(gzip.decompress(compressed) == b"/* static fixture */\n" * 300, "Compressed content integrity")
        require(headers.get("Cache-Control") == "public, max-age=31536000, immutable", "Hashed build asset caching")
        require("Accept-Encoding" in headers.get("Vary", ""), "Compression negotiation")
        require("Cache-Control" not in request("/_next/static/chunks/missing.js")[1], "Do not cache missing build assets")
        require("Cache-Control" not in request("/api/v1/csrf/")[1], "Do not add public cache policy to API")
        h2_context = ssl.create_default_context(cafile=str(qa / "cert.pem"))
        h2_context.set_alpn_protocols(["h2"])
        with h2_context.wrap_socket(socket.create_connection(("127.0.0.1", 18443), timeout=5), server_hostname="mu56.ru") as sock:
            require(sock.selected_alpn_protocol() == "h2", "HTTP/2 TLS negotiation")
        # Sanitized log must omit query parameters, including on backend routes.
        request("/api/v1/csrf/?qa-secret=should-not-be-logged")
        process.terminate()
        process.wait(timeout=10)
        logs = (qa / "logs/mu56-access.log").read_text()
        require("qa-secret" not in logs and "should-not-be-logged" not in logs, "Access log excludes query data")
        print("Nginx syntax and 22 isolated proxy/static/TLS/compression/cache checks passed.")
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
        for server in servers:
            server.shutdown()
            server.server_close()

    if args.skip_systemd:
        print("Systemd checks explicitly skipped; this run verifies Nginx only.")
        raise SystemExit(0)

    # Verify unit syntax in a fake filesystem. Placeholder executables are never run.
    unit_root = qa / "unit-root"
    units = unit_root / "etc/systemd/system"
    units.mkdir(parents=True)
    for name in ("multi-user.target", "network.target", "network-online.target", "sysinit.target", "basic.target", "shutdown.target"):
        (units / name).write_text("[Unit]\nDescription=QA placeholder\n")
    for name in ("postgresql.service", "nginx.service"):
        (units / name).write_text("[Unit]\nDescription=QA placeholder\n[Service]\nExecStart=/bin/true\n")
    for executable in ("bin/true", "usr/bin/node", "srv/mu56/current/.venv/bin/python", "srv/mu56/current/.venv/bin/gunicorn"):
        target = unit_root / executable
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile("/bin/true", target)
        target.chmod(0o755)
    service_paths = []
    for source in sorted((repo / "deploy/systemd").glob("mu56-*")):
        target = units / source.name
        shutil.copyfile(source, target)
        service_paths.append(str(target))
    result = subprocess.run(["systemd-analyze", "verify", "--man=no", f"--root={unit_root}", *service_paths],
                            capture_output=True, text=True, timeout=30)
    require(result.returncode == 0, "systemd verification: " + result.stderr)
    print(f"{len(service_paths)} systemd service/timer templates parsed successfully (services not started).")
