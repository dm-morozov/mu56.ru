"""Read-only HTTP acceptance checks for a staging site; never submits a lead."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.robots = set()
        self.headings = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h1":
            self.headings += 1
        if tag == "meta" and attrs.get("name", "").lower() == "robots":
            self.robots.update(part.strip().lower() for part in attrs.get("content", "").split(","))


def validate(path, content, headers):
    if path == "/robots.txt":
        # Check the wildcard group, rather than accepting a rule for another bot.
        wildcard = False
        blocked = False
        for line in content.splitlines():
            line = line.split("#", 1)[0].strip()
            if not line:
                wildcard = False
                continue
            key, _, value = line.partition(":")
            if key.lower() == "user-agent":
                wildcard = value.strip() == "*"
            elif wildcard and key.lower() == "disallow" and value.strip() == "/":
                blocked = True
        if not blocked:
            raise ValueError("Wildcard crawling is not blocked")
    elif path == "/sitemap.xml":
        root = ET.fromstring(content)
        if root.tag.split("}")[-1] != "urlset" or list(root):
            raise ValueError("Staging sitemap must be an empty urlset")
    elif path.startswith("/api/"):
        data = json.loads(content)
        if not isinstance(data, dict) or not isinstance(data.get("results"), list) or not data["results"]:
            raise ValueError("Catalog API must return non-empty results")
    else:
        if "text/html" not in headers.get("Content-Type", ""):
            raise ValueError("Expected HTML")
        page = Page(content)
        header_robots = {part.strip().lower() for part in headers.get("X-Robots-Tag", "").split(",")}
        if "noindex" not in page.robots | header_robots:
            raise ValueError("Staging page is missing noindex")
        if not page.headings:
            raise ValueError("Page has no H1")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url", help="Staging HTTPS origin, without credentials or path")
    parser.add_argument("--allow-http", action="store_true", help="Only for local checks; does not verify TLS")
    parser.add_argument("--report", type=Path, help="Optional JSON report; contains no response bodies")
    args = parser.parse_args()
    origin = args.base_url.rstrip("/")
    parsed = urlsplit(origin)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username
            or parsed.password or parsed.path or parsed.query or parsed.fragment):
        parser.error("Use an HTTP(S) origin without credentials, path, query or fragment")
    if parsed.scheme != "https" and not args.allow_http:
        parser.error("HTTPS is required; --allow-http is reserved for local checks")
    paths = ["/", "/packages", "/characters", "/transformers", "/new-year", "/shows",
             "/privacy", "/consent", "/robots.txt", "/sitemap.xml",
             "/api/v1/offerings/", "/api/v1/characters/"]
    checks = []
    for path in paths:
        try:
            request = Request(origin + path, headers={"User-Agent": "mu56-staging-check/1.0"})
            with urlopen(request, timeout=20) as response:
                if response.status != 200 or response.url != origin + path:
                    raise ValueError("Expected direct HTTP 200 without redirects")
                body = response.read(4 * 1024 * 1024 + 1)
                if len(body) > 4 * 1024 * 1024:
                    raise ValueError("Response exceeds check limit")
                validate(path, body.decode("utf-8"), response.headers)
            checks.append({"path": path, "passed": True})
        except (HTTPError, URLError, ValueError, ET.ParseError, TimeoutError, OSError):
            # Do not print server response bodies, exception URLs or credentials.
            checks.append({"path": path, "passed": False})
    report = {"passed": all(item["passed"] for item in checks), "checks": checks,
              "tls_required": parsed.scheme == "https",
              "scope": "GET only; no booking, Telegram, systemd, backups or rollback checks"}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
