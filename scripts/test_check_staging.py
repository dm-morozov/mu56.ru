import unittest

from check_staging import validate


class StagingChecks(unittest.TestCase):
    def test_html_requires_noindex_and_heading(self):
        validate("/", '<meta name="robots" content="noindex, follow"><h1>Party</h1>', {"Content-Type": "text/html"})
        with self.assertRaises(ValueError):
            validate("/", "<h1>Public</h1>", {"Content-Type": "text/html"})

    def test_login_page_is_not_site(self):
        with self.assertRaises(ValueError):
            validate("/", '<meta name="robots" content="noindex">Login', {"Content-Type": "text/html"})

    def test_crawler_specific_block_is_not_wildcard_block(self):
        with self.assertRaises(ValueError):
            validate("/robots.txt", "User-agent: Googlebot\nDisallow: /", {})
        validate("/robots.txt", "User-agent: *\nDisallow: /", {})

    def test_sitemap_must_not_publish_staging_urls(self):
        validate("/sitemap.xml", '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', {})
        with self.assertRaises(ValueError):
            validate("/sitemap.xml", "<urlset><url><loc>https://preview.example</loc></url></urlset>", {})

    def test_catalog_must_contain_records(self):
        validate("/api/v1/characters/", '{"results": [{"name": "Hero"}]}', {})
        with self.assertRaises(ValueError):
            validate("/api/v1/characters/", '{"results": []}', {})


if __name__ == "__main__":
    unittest.main()
