"""Read-only sitemap/link audit. Fetches public HTML, never submits forms."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit
from urllib.request import urlopen
import xml.etree.ElementTree as ET


class Page(HTMLParser):
    def __init__(self, final_url, body):
        super().__init__()
        self.final_url = final_url
        self.links, self.ids = [], set()
        self.feed(body)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        if tag == 'a':
            if attrs.get('name'):
                self.ids.add(attrs['name'])
            if attrs.get('href'):
                self.links.append(attrs['href'])


def page_url(url):
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path or '/', '', ''))


def audit(base, timeout=25, workers=3, retries=1, reader=None):
    origin = urlsplit(base)
    if origin.scheme not in ('http', 'https') or not origin.netloc or origin.path not in ('', '/'):
        raise ValueError('Base must be an HTTP(S) origin without a path.')
    if origin.query or origin.fragment or origin.username or origin.password:
        raise ValueError('Base must not contain credentials, query or fragment.')
    base = base.rstrip('/')
    origins = (origin.scheme, origin.netloc)

    def read(url):
        if reader is not None:
            return reader(url)
        with urlopen(url, timeout=timeout) as response:
            return response.geturl(), response.read().decode('utf-8')

    retry_log = []

    def fetch(url):
        attempts = []
        for attempt in range(retries + 1):
            try:
                final, body = read(url)
                final_parts = urlsplit(final)
                if (final_parts.scheme, final_parts.netloc) != origins:
                    raise ValueError('Redirect outside audited origin')
                return url, Page(final, body), attempts, None
            except Exception as exc:
                attempts.append(type(exc).__name__)
        return url, None, attempts, attempts[-1]

    final_sitemap, sitemap_body = read(base + '/sitemap.xml')
    if (urlsplit(final_sitemap).scheme, urlsplit(final_sitemap).netloc) != origins:
        raise ValueError('Sitemap redirect outside audited origin')
    urls = set()
    for loc in ET.fromstring(sitemap_body).findall('{*}url/{*}loc'):
        url = page_url(loc.text or '')
        parts = urlsplit(url)
        if (parts.scheme, parts.netloc) != origins:
            raise ValueError('Sitemap contains a URL outside audited origin')
        urls.add(url)
    if not urls:
        raise ValueError('Sitemap has no URLs; cannot claim a successful full audit.')
    pages, failures = {}, []

    def collect(batch):
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for url, page, attempts, error in pool.map(fetch, sorted(batch)):
                if error:
                    failures.append({'url': url, 'error_type': error, 'attempts': len(attempts)})
                else:
                    pages[url] = page
                    if attempts:
                        retry_log.append({'url': url, 'recovered_after': len(attempts)})

    collect(urls)
    links = []
    excluded = ('/api/', '/admin/', '/media/', '/uploads/', '/static/', '/_next/')
    for source, page in list(pages.items()):
        for href in page.links:
            target = urlsplit(urljoin(page.final_url, href))
            if (target.scheme, target.netloc) != origins or target.path.startswith(excluded):
                continue
            # Strip query strings from both requests and stored evidence.
            links.append((source, page_url(target.geturl()), unquote(target.fragment)))
    targets = {target for _, target, _ in links}
    collect(targets - urls)
    broken = []
    for source, target, fragment in links:
        if fragment and target in pages and fragment not in pages[target].ids:
            broken.append({'source': source, 'target': target, 'fragment': fragment})
    return {
        'base': base, 'result': 'failed' if failures or broken else 'passed',
        'sitemap_urls': len(urls), 'pages_checked': len(pages),
        'internal_targets': len(targets), 'fetch_errors': failures,
        'recovered_requests': retry_log, 'missing_anchors': broken,
        'limits': 'Server HTML only; excludes client-only links, external destinations and form submission.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='https://mu56.ru')
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--timeout', type=int, default=25)
    parser.add_argument('--workers', type=int, choices=range(1, 5), default=3)
    parser.add_argument('--retries', type=int, choices=range(0, 3), default=1)
    args = parser.parse_args()
    if not 1 <= args.timeout <= 120:
        parser.error('timeout must be 1–120 seconds')
    try:
        report = audit(args.base, args.timeout, args.workers, args.retries)
    except Exception as exc:
        report = {'base': args.base, 'result': 'failed', 'error_type': type(exc).__name__}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True))
    return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
