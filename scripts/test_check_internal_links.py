import unittest
from check_internal_links import audit


class LinkAuditTests(unittest.TestCase):
    def reader(self, pages):
        def read(url):
            value = pages[url]
            if isinstance(value, list):
                value = value.pop(0)
            if isinstance(value, Exception):
                raise value
            return value
        return read

    def test_relative_redirect_extra_page_anchor_retry_and_query_privacy(self):
        pages = {
            'https://site.test/sitemap.xml': ('https://site.test/sitemap.xml', '<urlset><url><loc>https://site.test/old</loc></url></urlset>'),
            'https://site.test/old': [TimeoutError(), ('https://site.test/dir/page', '<a href="child?phone=private#target">go</a>')],
            'https://site.test/dir/child': ('https://site.test/dir/child', '<a name="target"></a>'),
        }
        result = audit('https://site.test', reader=self.reader(pages))
        self.assertEqual(result['result'], 'passed')
        self.assertEqual(result['pages_checked'], 2)
        self.assertEqual(len(result['recovered_requests']), 1)
        self.assertNotIn('private', str(result))

    def test_missing_anchor_and_transport_failure_are_not_success(self):
        pages = {
            'https://site.test/sitemap.xml': ('https://site.test/sitemap.xml', '<urlset><url><loc>https://site.test/</loc></url></urlset>'),
            'https://site.test/': ('https://site.test/', '<a href="#missing">bad</a><a href="/broken">bad</a>'),
            'https://site.test/broken': OSError(),
        }
        result = audit('https://site.test', reader=self.reader(pages))
        self.assertEqual(result['result'], 'failed')
        self.assertEqual(len(result['missing_anchors']), 1)
        self.assertEqual(result['fetch_errors'][0]['attempts'], 2)

    def test_empty_or_external_sitemap_is_rejected(self):
        for xml in ('<urlset/>', '<urlset><url><loc>https://other.test/</loc></url></urlset>'):
            with self.subTest(xml=xml), self.assertRaises(ValueError):
                audit('https://site.test', reader=lambda _: ('https://site.test/sitemap.xml', xml))


if __name__ == '__main__':
    unittest.main()
