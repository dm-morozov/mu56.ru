import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen
import xml.etree.ElementTree as ET


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta, self.canonical, self.schemas = {}, None, []
        self.json = False
        self.buffer = ""

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == "meta":
            self.meta[data.get("name") or data.get("property")] = data.get("content", "")
        if tag == "link" and data.get("rel") == "canonical":
            self.canonical = data.get("href")
        if tag == "script" and data.get("type") == "application/ld+json":
            self.json = True
            self.buffer = ""

    def handle_data(self, data):
        if self.json:
            self.buffer += data

    def handle_endtag(self, tag):
        if tag == "script" and self.json:
            self.schemas.append(json.loads(self.buffer))
            self.json = False


parser = argparse.ArgumentParser()
parser.add_argument("--base", default="http://127.0.0.1:3000")
parser.add_argument("--indexing", action="store_true")
args = parser.parse_args()
base = args.base.rstrip("/")
def get(path):
    return urlopen(base + path, timeout=15).read().decode("utf-8")
def catalog(route):
    rows = []
    page = 1
    while True:
        data = json.loads(get(f"/api/v1/{route}/?page={page}"))
        rows.extend(data["results"])
        if not data["next"]:
            return rows
        page += 1

paths = {p:p for p in ["/", "/animators", "/transformers", "/packages", "/shows", "/extras", "/characters", "/new-year", "/gallery", "/contacts", "/reviews", "/articles", "/holidays", "/holidays/kindergarten", "/holidays/graduation", "/holidays/large-events"]}
for hero in catalog("characters"):
    slug = hero["slug"]
    if slug == "new-year-duo":
        continue
    paths[f"/characters/{slug}"] = f"/transformers/{slug}" if slug in ["bumblebee", "optimus-prime", "iron-man"] else f"/characters/{slug}"
for offering in catalog("offerings"):
    section = {"transformer":"transformers", "package":"packages", "show":"shows", "extra":"extras"}.get(offering["kind"])
    if section:
        path = f"/{section}/{offering['slug']}"
        paths[path] = path
for article in catalog("articles"):
    path = f"/articles/{article['slug']}"
    paths[path] = path
for path, canonical in paths.items():
    head = Head()
    head.feed(get(path))
    assert head.canonical.rstrip("/") == f"https://mu56.ru{canonical}".rstrip("/"), (path, head.canonical)
    assert bool(head.meta.get("description")), path
    assert ("noindex" not in head.meta.get("robots", "")) == args.indexing, path
    assert any(s.get("@type") == "Organization" for s in head.schemas), path
    for schema in head.schemas:
        if schema.get("@type") == "Service":
            assert schema["url"] == head.canonical
            assert all(o["price"] > 0 and o["priceCurrency"] == "RUB" for o in schema["offers"])
robots = get("/robots.txt")
urls = [node.text for node in ET.fromstring(get("/sitemap.xml")).findall("{*}url/{*}loc")]
if args.indexing:
    assert "Sitemap: https://mu56.ru/sitemap.xml" in robots
    assert set(urls) == {f"https://mu56.ru{path}" for path in paths.values()}
else:
    assert "Disallow: /" in robots
    assert not urls
report = {"pages_checked":len(paths), "indexing_enabled":args.indexing, "sitemap_urls":len(urls), "result":"passed"}
target = Path(__file__).resolve().parents[1] / "docs/seo-check.json"
target.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report))

