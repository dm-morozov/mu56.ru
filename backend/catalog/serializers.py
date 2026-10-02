from rest_framework import serializers

from .models import Article, Review, Character, CharacterPhoto, ContactChannel, Offering, PackagePart, PriceOption


class CharacterPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return obj.image.url

    class Meta:
        model = CharacterPhoto
        fields = ("url", "alt", "position")


class CharacterSerializer(serializers.ModelSerializer):
    availability_label = serializers.CharField(source="get_availability_display", read_only=True)
    photos = CharacterPhotoSerializer(source="public_photos", many=True, read_only=True)

    class Meta:
        model = Character
        fields = ("slug", "name", "category", "description", "availability", "availability_label", "photos")


class PriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceOption
        fields = ("code", "label", "context", "amount_rub", "duration_minutes")


class PackagePartSerializer(serializers.ModelSerializer):
    service_slug = serializers.SerializerMethodField()

    def get_service_slug(self, obj):
        return obj.service.slug if obj.service and obj.service.is_listed else None

    class Meta:
        model = PackagePart
        fields = ("position", "title", "duration_minutes", "is_approximate", "led_by_performer", "service_slug")


class OfferingSerializer(serializers.ModelSerializer):
    prices = PriceSerializer(source="public_prices", many=True, read_only=True)
    characters = CharacterSerializer(source="public_characters", many=True, read_only=True)
    parts = PackagePartSerializer(many=True, read_only=True)
    availability_label = serializers.CharField(source="get_availability_display", read_only=True)

    class Meta:
        model = Offering
        fields = (
            "slug", "name", "kind", "description", "duration_minutes", "duration_is_approximate",
            "included_performers", "availability", "availability_label", "requirements", "prices", "characters", "parts",
        )


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactChannel
        fields = ("kind", "label", "url")


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ("author", "text", "source_label", "source_url")


class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = ("title", "slug", "excerpt", "published_at")


class ArticleDetailSerializer(ArticleSerializer):
    related_offering = serializers.SerializerMethodField()

    def get_related_offering(self, obj):
        offering = obj.related_offering
        if offering and offering.is_listed:
            return {"slug": offering.slug, "name": offering.name, "kind": offering.kind}
        return None

    class Meta(ArticleSerializer.Meta):
        fields = ArticleSerializer.Meta.fields + ("body", "seo_title", "seo_description", "related_offering")
