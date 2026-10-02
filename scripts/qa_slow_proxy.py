"""Loopback-only browser QA proxy. Never forwards POSTs or logs form bodies."""
import argparse
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError

parser = argparse.ArgumentParser()
parser.add_argument("--mode", choices=["csrf", "post"], required=True)
parser.add_argument("--port", type=int, required=True)
args = parser.parse_args()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *unused):
        pass

    def do_GET(self):
        if args.mode == "csrf" and self.path.split("?")[0] == "/api/v1/csrf/":
            time.sleep(22)
            try:
                self.send_error(504)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass
            return
        request = Request("http://127.0.0.1:3000" + self.path,
                          headers={key: value for key, value in self.headers.items()
                                   if key.lower() in ["cookie", "accept", "user-agent"]})
        try:
            response = urlopen(request, timeout=30)
        except HTTPError as error:
            response = error
        with response:
            data = response.read()
            self.send_response(response.status)
            for key, value in response.headers.items():
                if key.lower() not in ["transfer-encoding", "connection", "content-length"]:
                    self.send_header(key, value)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

    def do_POST(self):
        # Deliberately do not send the submitted data to Django.
        if args.mode == "post":
            time.sleep(22)
        try:
            self.send_error(503)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


print(f"QA {args.mode}: http://127.0.0.1:{args.port} (POST forwarding disabled)", flush=True)
ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
