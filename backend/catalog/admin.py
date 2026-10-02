from django.contrib import admin

from .models import Article, Review, Character, CharacterPhoto, ContactChannel, Offering, PackagePart, PriceOption
from django.utils.html import format_html

admin.site.site_header = "Мир Улыбок — управление сайтом"
admin.site.site_title = "Мир Улыбок"
admin.site.index_title = "Каталог и контакты"


class CharacterPhotoInline(admin.TabularInline):
    model = CharacterPhoto
    extra = 0
    fields = ("preview", "image", "alt", "position", "is_listed")
    readonly_fields = ("preview",)

    @admin.display(description="Просмотр")
    def preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" alt="" style="width:100px;height:80px;object-fit:cover">', obj.image.url)
        return "—"


@admin.register(Character)
class CharacterAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "availability", "is_listed")
    list_filter = ("category", "availability", "is_listed")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
    inlines = (CharacterPhotoInline,)


class PriceInline(admin.TabularInline):
    model = PriceOption
    extra = 0


class PackagePartInline(admin.TabularInline):
    model = PackagePart
    fk_name = "package"
    extra = 0
    autocomplete_fields = ("service",)


@admin.register(Offering)
class OfferingAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "duration_minutes", "included_performers", "availability", "is_listed")
    list_filter = ("kind", "availability", "is_listed")
    search_fields = ("name", "description")
    prepopulated_fields = {"slug": ("name",)}
    filter_horizontal = ("characters",)
    inlines = (PriceInline,)

    def get_inlines(self, request, obj):
        if obj and obj.kind == Offering.Kind.PACKAGE:
            return (PriceInline, PackagePartInline)
        return (PriceInline,)


@admin.register(ContactChannel)
class ContactChannelAdmin(admin.ModelAdmin):
    list_display = ("kind", "label", "is_verified")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("author", "source_label", "position", "is_published")
    list_filter = ("is_published", "source_label")
    search_fields = ("author", "text")
    list_editable = ("position", "is_published")


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "published_at", "is_published")
    list_filter = ("is_published",)
    search_fields = ("title", "body")
    prepopulated_fields = {"slug": ("title",)}
    autocomplete_fields = ("related_offering",)
    fieldsets = (
        ("Статья", {"fields": ("title", "slug", "excerpt", "body", "related_offering")}),
        ("Публикация", {"fields": ("is_published", "published_at")}),
        ("Поисковое описание", {"fields": ("seo_title", "seo_description")}),
    )
