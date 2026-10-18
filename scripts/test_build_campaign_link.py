import unittest
from urllib.parse import parse_qs, urlsplit

from build_campaign_link import campaign_link


class CampaignLinkTests(unittest.TestCase):
    def test_partner_link_retains_destination_and_labels(self):
        url = urlsplit(campaign_link("/venues/vinni-puh", "winnipuhtort", "venue_partner"))
        self.assertEqual((url.scheme, url.netloc, url.path), ("https", "mu56.ru", "/venues/vinni-puh"))
        self.assertEqual(parse_qs(url.query), {
            "utm_source": ["winnipuhtort"], "utm_medium": ["referral"],
            "utm_campaign": ["venue_partner"],
        })

    def test_homepage_and_optional_content(self):
        url = campaign_link("/", "vk", "programs", "social", "pinned_post")
        self.assertTrue(url.startswith("https://mu56.ru/?"))
        self.assertEqual(parse_qs(urlsplit(url).query)["utm_content"], ["pinned_post"])

    def test_rejects_external_private_and_ambiguous_paths(self):
        for path in ["https://example.org/", "//example.org/", "/admin/", "/api/v1/leads/",
                     "/privacy", "/packages?phone=123", "/shows#catalog", "/../admin", "/unknown"]:
            with self.subTest(path=path), self.assertRaises(ValueError):
                campaign_link(path, "vk", "programs")

    def test_rejects_free_text_and_unsupported_medium(self):
        for source in ["User Name", "+79030000000", "user@example.org", "", "x" * 65]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                campaign_link("/", source, "programs")
        with self.assertRaises(ValueError):
            campaign_link("/", "vk", "programs", "unsupported")


if __name__ == "__main__":
    unittest.main()
