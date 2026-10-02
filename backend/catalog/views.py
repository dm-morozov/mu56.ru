from django.db.models import Prefetch
from rest_framework import generics, serializers
from django.utils import timezone

from .models import Article, Review, Character, CharacterPhoto, ContactChannel, Offering, PackagePart, PriceOption
from .serializers import ArticleSerializer, ArticleDetailSerializer, ReviewSerializer, CharacterSerializer, ContactSerializer, OfferingSerializer


def public_characters():
    return Character.objects.filter(is_listed=True).prefetch_related(
        Prefetch("photos", queryset=CharacterPhoto.objects.filter(is_listed=True), to_attr="public_photos"),
    )


def public_offerings():
    return Offering.objects.filter(is_listed=True).prefetch_related(
        Prefetch("prices", queryset=PriceOption.objects.filter(is_confirmed=True), to_attr="public_prices"),
        Prefetch("characters", queryset=public_characters(), to_attr="public_characters"),
        Prefetch("parts", queryset=PackagePart.objects.select_related("service")),
    )


class OfferingList(generics.ListAPIView):
    serializer_class = OfferingSerializer

    def get_queryset(self):
        queryset = public_offerings()
        kind = self.request.query_params.get("kind")
        if kind:
            if kind not in Offering.Kind.values:
                raise serializers.ValidationError({"kind": "Неизвестный тип предложения."})
            queryset = queryset.filter(kind=kind)
        return queryset


class OfferingDetail(generics.RetrieveAPIView):
    serializer_class = OfferingSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return public_offerings()


class CharacterList(generics.ListAPIView):
    serializer_class = CharacterSerializer
    queryset = public_characters()


class CharacterDetail(generics.RetrieveAPIView):
    serializer_class = CharacterSerializer
    queryset = public_characters()
    lookup_field = "slug"


class ContactList(generics.ListAPIView):
    serializer_class = ContactSerializer
    queryset = ContactChannel.objects.filter(is_verified=True).order_by("kind")
    pagination_class = None


class ReviewList(generics.ListAPIView):
    serializer_class = ReviewSerializer
    queryset = Review.objects.filter(is_published=True)


class ArticleList(generics.ListAPIView):
    serializer_class = ArticleSerializer

    def get_queryset(self):
        return Article.objects.filter(is_published=True, published_at__lte=timezone.now())


class ArticleDetail(generics.RetrieveAPIView):
    serializer_class = ArticleDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Article.objects.filter(is_published=True, published_at__lte=timezone.now()).select_related("related_offering")
