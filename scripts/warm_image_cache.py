"""Warm common Next image variants sequentially after deployment; GET only."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import time
from urllib.parse import urlsplit
from urllib.error import URLError
from urllib.request import Request, urlopen

PAGES = ('/', '/characters', '/transformers', '/shows', '/packages', '/new-year')


class Images(HTMLParser):
    def __init__(self, widths):
        super().__init__()
        self.widths = widths
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        if tag != 'img':
            return
        for entry in dict(attrs).get('srcset', '').split(', '):
            parts = entry.rsplit(' ', 1)
            if len(parts) == 2 and parts[1] in self.widths:
                url = urlsplit(parts[0])
                if not url.scheme and not url.netloc and url.path == '/_next/image':
                    self.urls.add(parts[0])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('origin')
    parser.add_argument('--limit', type=int, default=120)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    origin = args.origin.rstrip('/')
    url = urlsplit(origin)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.path or url.query or url.fragment:
        parser.error('Use an HTTPS origin without credentials or path')
    if not 1 <= args.limit <= 200:
        parser.error('Limit must be between 1 and 200')
    images = Images({'640w', '828w'})
    for page in PAGES:
        with urlopen(origin + page, timeout=30) as response:
            images.feed(response.read(4 * 1024 * 1024).decode('utf-8'))
    urls = sorted(images.urls)
    if len(urls) > args.limit:
        parser.error('Image count exceeds the limit; review before increasing it')
    checks = []
    for index, path in enumerate(urls, start=1):
        for attempt in range(2):
            started = time.monotonic()
            request = Request(origin + path, headers={'Accept': 'image/webp', 'User-Agent': 'mu56-cache-warm/1.0'})
            try:
                with urlopen(request, timeout=20) as response:
                    if response.status != 200 or response.url != origin + path or not response.headers.get('Content-Type', '').startswith('image/'):
                        raise ValueError('Expected a direct image response')
                    size = len(response.read(10 * 1024 * 1024 + 1))
                    if size > 10 * 1024 * 1024:
                        raise ValueError('Image exceeds response limit')
                    checks.append({'seconds': round(time.monotonic() - started, 3), 'bytes': size,
                                   'cache': response.headers.get('X-Nextjs-Cache', ''), 'retried': bool(attempt)})
                break
            except (URLError, TimeoutError, OSError):
                if attempt:
                    raise
                print(f'Retrying image {index} after a transport error', flush=True)
        print(f'Images ready: {index}/{len(urls)}', flush=True)
    report = {'images': len(checks), 'passed': True, 'variants': [640, 828], 'format': 'webp',
              'total_bytes': sum(item['bytes'] for item in checks), 'checks': checks}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key != 'checks'}))


if __name__ == '__main__':
    main()
