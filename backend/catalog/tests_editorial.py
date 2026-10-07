from datetime import timedelta
from io import StringIO
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from .models import Article, Offering, Review
from .management.commands.seed_editorial import ARTICLES


class EditorialTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalog", stdout=StringIO())
        call_command("seed_editorial", stdout=StringIO())

    def test_drafts_and_scheduled_articles_are_not_public(self):
        article = Article.objects.first()
        article.is_published = False
        article.save()
        self.assertEqual(self.client.get(f"/api/v1/articles/{article.slug}/").status_code, 404)
        article.is_published = True
        article.published_at = timezone.now() + timedelta(days=1)
        article.save()
        self.assertEqual(self.client.get(f"/api/v1/articles/{article.slug}/").status_code, 404)
        self.assertNotIn(article.slug, [a["slug"] for a in self.client.get("/api/v1/articles/").json()["results"]])
        article.published_at = timezone.now() - timedelta(seconds=1)
        article.save()
        self.assertEqual(self.client.get(f"/api/v1/articles/{article.slug}/").status_code, 200)

    def test_hidden_reviews_and_source_keys_are_not_exposed(self):
        review = Review.objects.first()
        review.is_published = False
        review.save()
        data = self.client.get("/api/v1/reviews/").json()
        self.assertEqual(data["count"], Review.objects.filter(is_published=True).count())
        self.assertNotIn(review.author, [r["author"] for r in data["results"]])
        self.assertNotIn("source_key", data["results"][0])
        self.assertEqual(self.client.post("/api/v1/reviews/", {}).status_code, 405)

    def test_repeat_seed_preserves_owner_edits(self):
        article = Article.objects.first()
        article.body = "Текст владельца"
        article.is_published = False
        article.save()
        review = Review.objects.first()
        review.text = "Уточнённый отзыв"
        review.save()
        call_command("seed_editorial", stdout=StringIO())
        article.refresh_from_db()
        review.refresh_from_db()
        self.assertEqual(article.body, "Текст владельца")
        self.assertFalse(article.is_published)
        self.assertEqual(review.text, "Уточнённый отзыв")
        self.assertEqual(Article.objects.count(), len(ARTICLES))

    def test_article_does_not_promote_hidden_offering(self):
        article = Article.objects.get(slug="transformer-doma")
        self.assertEqual(self.client.get(f"/api/v1/articles/{article.slug}/").json()["related_offering"]["slug"], "bumblebee")
        Offering.objects.filter(slug="bumblebee").update(is_listed=False)
        self.assertIsNone(self.client.get(f"/api/v1/articles/{article.slug}/").json()["related_offering"])
