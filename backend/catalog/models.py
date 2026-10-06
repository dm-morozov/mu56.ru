from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MinValueValidator
from django.db import models
from .media import character_photo_path, validate_photo_size
from django.utils import timezone


class Availability(models.TextChoices):
    AVAILABLE = "available", "Дату согласуем"
    CHECK = "check", "Доступность уточняйте"
    UNAVAILABLE = "unavailable", "Временно недоступно"


class Character(models.Model):
    name = models.CharField("Имя", max_length=150)
    slug = models.SlugField("Адрес", unique=True)
    category = models.CharField("Категория", max_length=100)
    description = models.TextField("Описание программы", blank=True)
    availability = models.CharField("Доступность", max_length=20, choices=Availability, default=Availability.AVAILABLE)
    is_listed = models.BooleanField("Показывать в каталоге", default=True)

    class Meta:
        ordering = ["category", "name"]
        verbose_name = "Персонаж"
        verbose_name_plural = "Персонажи"

    def __str__(self):
        return self.name


class CharacterPhoto(models.Model):
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name="photos", verbose_name="Персонаж")
    image = models.ImageField("Фотография", upload_to=character_photo_path, validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"]), validate_photo_size])
    alt = models.CharField("Описание фотографии", max_length=250, help_text="Кратко опишите, что происходит на фото.")
    position = models.PositiveSmallIntegerField("Порядок", default=0)
    is_listed = models.BooleanField("Показывать на сайте", default=True)
    source_key = models.CharField(max_length=500, unique=True, null=True, blank=True, editable=False)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = "Фотография персонажа"
        verbose_name_plural = "Фотографии персонажей"

    def __str__(self):
        return f"{self.character}: {self.alt}"


class Offering(models.Model):
    class Kind(models.TextChoices):
        ANIMATION = "animation", "Анимация"
        TRANSFORMER = "transformer", "Большой герой + супергерой"
        SHOW = "show", "Шоу"
        PACKAGE = "package", "Пакет"
        EXTRA = "extra", "Дополнение"
        SEASONAL = "seasonal", "Новый год"

    name = models.CharField("Название", max_length=150)
    slug = models.SlugField("Адрес", unique=True)
    kind = models.CharField("Тип", max_length=20, choices=Kind)
    description = models.TextField("Описание", blank=True)
    duration_minutes = models.PositiveSmallIntegerField("Общее время, мин", null=True, blank=True, validators=[MinValueValidator(1)])
    duration_is_approximate = models.BooleanField("Время приблизительное", default=False)
    included_performers = models.PositiveSmallIntegerField("Исполнителей включено", default=1, validators=[MinValueValidator(1)])
    characters = models.ManyToManyField(Character, blank=True, verbose_name="Персонажи")
    availability = models.CharField("Доступность", max_length=20, choices=Availability, default=Availability.AVAILABLE)
    requirements = models.TextField("Требования площадки", blank=True)
    service_position = models.PositiveSmallIntegerField("Порядок в услугах", null=True, blank=True,
        help_text="Меньше число — выше карточка. Пустое поле — нет карточки в разделе услуг. Порядок общей карточки трансформеров задаётся у Бамблби.")
    is_listed = models.BooleanField("Показывать в каталоге", default=True)

    class Meta:
        ordering = ["kind", "name"]
        verbose_name = "Предложение"
        verbose_name_plural = "Предложения"

    def __str__(self):
        return self.name


class PriceOption(models.Model):
    class Context(models.TextChoices):
        BASE = "base", "Основная цена"
        WITH_ANIMATION = "with_animation", "Шоу с анимацией"
        SECOND_PERFORMER = "second_performer", "Доплата второго аниматора в пакете"
        TRANSFORMER_SUPPORT = "transformer_support", "Второй участник: шоу после трансформера"

    offering = models.ForeignKey(Offering, on_delete=models.CASCADE, related_name="prices", verbose_name="Предложение")
    code = models.SlugField("Код тарифа")
    label = models.CharField("Название тарифа", max_length=150)
    context = models.CharField("Условие", max_length=25, choices=Context, default=Context.BASE)
    amount_rub = models.PositiveIntegerField("Цена, ₽", null=True, blank=True, validators=[MinValueValidator(1)])
    duration_minutes = models.PositiveSmallIntegerField("Время тарифа, мин", null=True, blank=True, validators=[MinValueValidator(1)])
    is_confirmed = models.BooleanField("Цена подтверждена", default=False)
    terms = models.TextField("Условия", blank=True)

    class Meta:
        ordering = ["offering", "id"]
        verbose_name = "Тариф"
        verbose_name_plural = "Тарифы"
        constraints = [
            models.UniqueConstraint(fields=["offering", "code"], name="unique_offering_price_code"),
            models.CheckConstraint(condition=models.Q(amount_rub__isnull=True) | models.Q(amount_rub__gt=0), name="positive_price_amount"),
            models.CheckConstraint(condition=models.Q(is_confirmed=False) | models.Q(amount_rub__isnull=False), name="confirmed_price_has_amount"),
        ]

    def clean(self):
        if self.is_confirmed and self.amount_rub is None:
            raise ValidationError({"amount_rub": "Для подтверждённого тарифа укажите цену."})
        if self.context == self.Context.SECOND_PERFORMER and self.offering.kind != Offering.Kind.PACKAGE:
            raise ValidationError({"context": "Эта доплата применяется только к пакетам."})
        if self.context in (self.Context.WITH_ANIMATION, self.Context.TRANSFORMER_SUPPORT) and self.offering.kind != Offering.Kind.SHOW:
            raise ValidationError({"context": "Этот тариф применяется только к шоу."})

    def __str__(self):
        return f"{self.offering}: {self.label}"


class PackagePart(models.Model):
    package = models.ForeignKey(Offering, on_delete=models.CASCADE, related_name="parts", verbose_name="Пакет")
    position = models.PositiveSmallIntegerField("Порядок", validators=[MinValueValidator(1)])
    title = models.CharField("Этап", max_length=150)
    duration_minutes = models.PositiveSmallIntegerField("Время, мин", validators=[MinValueValidator(1)])
    is_approximate = models.BooleanField("Время приблизительное", default=False)
    led_by_performer = models.BooleanField("Ведущие проводят программу", default=True)
    service = models.ForeignKey(Offering, on_delete=models.PROTECT, null=True, blank=True, related_name="used_in_packages", verbose_name="Услуга")

    class Meta:
        ordering = ["position"]
        verbose_name = "Этап пакета"
        verbose_name_plural = "Этапы пакета"
        constraints = [models.UniqueConstraint(fields=["package", "position"], name="unique_package_part_position")]

    def clean(self):
        if self.package.kind != Offering.Kind.PACKAGE:
            raise ValidationError({"package": "Этапы добавляются только в пакет."})
        if self.service_id and self.service.kind == Offering.Kind.PACKAGE:
            raise ValidationError({"service": "Вложенные пакеты не поддерживаются."})

    def __str__(self):
        return self.title


class ContactChannel(models.Model):
    class Kind(models.TextChoices):
        PHONE = "phone", "Телефон"
        TELEGRAM = "telegram", "Telegram"
        MAX = "max", "MAX"

    kind = models.CharField("Канал", max_length=20, choices=Kind, unique=True)
    label = models.CharField("Подпись", max_length=150)
    url = models.CharField("Ссылка (https:// или tel:)", max_length=500)
    is_verified = models.BooleanField("Проверено владельцем", default=False)

    class Meta:
        verbose_name = "Канал связи"
        verbose_name_plural = "Каналы связи"

    def clean(self):
        prefix = "tel:" if self.kind == self.Kind.PHONE else "https://"
        if not self.url.startswith(prefix):
            raise ValidationError({"url": f"Ссылка должна начинаться с {prefix}"})

    def __str__(self):
        return self.get_kind_display()


class Review(models.Model):
    author = models.CharField("Имя клиента", max_length=100)
    text = models.TextField("Текст отзыва")
    source_label = models.CharField("Источник", max_length=100, default="Avito")
    source_url = models.URLField("Ссылка на источник", blank=True)
    source_key = models.SlugField(unique=True, null=True, blank=True, editable=False)
    position = models.PositiveSmallIntegerField("Порядок", default=0)
    is_published = models.BooleanField("Показывать на сайте", default=False)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = "Отзыв"
        verbose_name_plural = "Отзывы"

    def __str__(self):
        return self.author


class Article(models.Model):
    title = models.CharField("Название", max_length=180)
    slug = models.SlugField("Адрес", unique=True)
    excerpt = models.TextField("Краткое описание")
    body = models.TextField("Текст статьи", help_text="Абзацы разделяйте пустой строкой. Заголовки разделов начинайте с ##.")
    seo_title = models.CharField("Заголовок для поиска", max_length=180, blank=True)
    seo_description = models.CharField("Описание для поиска", max_length=300, blank=True)
    related_offering = models.ForeignKey(Offering, on_delete=models.SET_NULL, blank=True, null=True, verbose_name="Предложить программу")
    is_published = models.BooleanField("Опубликовать", default=False)
    published_at = models.DateTimeField("Дата публикации", default=timezone.now, help_text="Будущая дата откладывает появление статьи на сайте.")

    class Meta:
        ordering = ["-published_at", "id"]
        verbose_name = "Статья"
        verbose_name_plural = "Статьи"

    def __str__(self):
        return self.title
