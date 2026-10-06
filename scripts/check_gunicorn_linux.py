"""Exercise the pinned Gunicorn configuration on Linux without Django or client data."""
import argparse
import http.client
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from zipfile import ZipFile

parser = argparse.ArgumentParser()
parser.add_argument("--wheel", required=True, type=Path)
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
if args.wheel.name != "gunicorn-26.2.0-py3-none-any.whl":
    raise SystemExit("Use the pinned Gunicorn 26.2.0 wheel from PyPI.")

with tempfile.TemporaryDirectory(prefix="mu56-gunicorn-qa-") as folder:
    qa = Path(folder)
    libraries = qa / "libraries"
    ZipFile(args.wheel).extractall(libraries)
    (qa / "qa_wsgi.py").write_text(
        "import json\n"
        "def application(environ, start_response):\n"
        "    body = json.dumps({'scheme': environ['wsgi.url_scheme'], 'path': environ['PATH_INFO']}).encode()\n"
        "    start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(body)))])\n"
        "    return [body]\n"
    )
    env = {**os.environ, "PYTHONPATH": str(libraries) + os.pathsep + str(qa)}
    command = [sys.executable, "-m", "gunicorn", "--config", str(repo / "deploy/gunicorn.conf.py"),
               "--bind", "127.0.0.1:18002", "qa_wsgi:application"]
    subprocess.run([*command, "--check-config"], env=env, cwd=qa, check=True, capture_output=True, timeout=30)
    with (qa / "gunicorn.log").open("wb") as log:
        process = subprocess.Popen(command, env=env, cwd=qa, stdout=log, stderr=log)

        def request(headers=None):
            connection = http.client.HTTPConnection("127.0.0.1", 18002, timeout=3)
            try:
                connection.request("GET", "/health/", headers=headers or {})
                response = connection.getresponse()
                if response.status != 200:
                    raise RuntimeError("Gunicorn fixture returned a failure.")
                return json.loads(response.read())
            finally:
                connection.close()

        try:
            for _ in range(50):
                if process.poll() is not None:
                    raise RuntimeError("Gunicorn did not start.")
                try:
                    plain = request()
                    break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("Gunicorn did not become ready.")
            secure = request({"Host": "mu56.ru", "X-Forwarded-Proto": "https"})
            ignored = request({"X-Forwarded-SSL": "on"})
            if plain["scheme"] != "http" or secure["scheme"] != "https" or ignored["scheme"] != "http":
                raise RuntimeError("Trusted scheme configuration did not match.")
        finally:
            process.terminate()
            process.wait(timeout=35)
    if (qa / "gunicorn.log").read_text().count("Booting worker") != 2:
        raise RuntimeError("Expected two Gunicorn workers to start.")
    print("Gunicorn 26.2.0: config, two workers and three loopback WSGI requests passed.")
