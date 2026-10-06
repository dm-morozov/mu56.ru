import uuid

from django.db import models
from django.utils import timezone


class Lead(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "Новая"
        CONTACTED = "contacted", "Связались"
        PROPOSAL = "proposal", "Обсуждаем программу"
        CONFIRMED = "confirmed", "Заказ согласован"
        CANCELLED = "cancelled", "Закрыта без заказа"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField("Получена", auto_now_add=True)
    name = models.CharField("Имя клиента", max_length=100, blank=True)
    phone = models.CharField("Телефон", max_length=20)
    contact_method = models.CharField("Способ связи", max_length=20, choices=[("phone", "Звонок"), ("telegram", "Telegram"), ("max", "MAX")], default="phone")
    messenger_handle = models.CharField("Контакт мессенджера", max_length=150, blank=True)
    event_date = models.DateField("Дата праздника", null=True, blank=True)
    event_time = models.TimeField("Время в Оренбурге", null=True, blank=True)
    child_age = models.PositiveSmallIntegerField("Возраст ребёнка", null=True, blank=True)
    children_count = models.PositiveSmallIntegerField("Количество детей", null=True, blank=True)
    location = models.CharField("Район / место", max_length=300, blank=True)
    comment = models.TextField("Пожелания клиента", max_length=2000, blank=True)
    offering = models.ForeignKey("catalog.Offering", on_delete=models.PROTECT, null=True, blank=True, verbose_name="Основная программа")
    character = models.ForeignKey("catalog.Character", on_delete=models.PROTECT, null=True, blank=True, verbose_name="Выбранный герой")
    second_character = models.ForeignKey("catalog.Character", on_delete=models.PROTECT, null=True, blank=True, related_name="second_character_leads", verbose_name="Второй герой в пакете")
    addons = models.ManyToManyField("catalog.Offering", related_name="lead_addons", blank=True, verbose_name="Шоу и дополнения")
    second_performer = models.BooleanField("Второй аниматор в пакете", default=False)
    selection_snapshot = models.JSONField("Состав и тарифы на момент заявки", default=dict, editable=False)
    status = models.CharField("Статус", max_length=20, choices=Status, default=Status.NEW)
    manager_notes = models.TextField("Внутренние заметки", blank=True)
    consent_at = models.DateTimeField("Согласие получено", editable=False)
    consent_version = models.CharField("Версия текста согласия", max_length=50, editable=False)
    notification_status = models.CharField("Уведомление в Telegram", max_length=50, default="Бот ещё не подключён", editable=False)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Заявка"
        verbose_name_plural = "Заявки"

    def __str__(self):
        return f"{self.name or 'Клиент'} — {self.phone}"


class TelegramNotification(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает отправки"
        SENDING = "sending", "Отправляется"
        SENT = "sent", "Отправлено"
        FAILED = "failed", "Ошибка — нужен повтор"
        UNCERTAIN = "uncertain", "Доставка не подтверждена"

    lead = models.OneToOneField(Lead, on_delete=models.CASCADE, related_name="telegram_notification")
    status = models.CharField("Состояние", max_length=20, choices=Status, default=Status.PENDING, db_index=True)
    attempts = models.PositiveIntegerField("Попыток", default=0)
    next_attempt_at = models.DateTimeField("Следующая попытка", default=timezone.now, db_index=True)
    started_at = models.DateTimeField("Начало попытки", null=True, blank=True)
    sent_at = models.DateTimeField("Telegram подтвердил отправку", null=True, blank=True)
    message_id = models.BigIntegerField("ID сообщения", null=True, blank=True)
    last_error = models.CharField("Причина", max_length=200, blank=True)
    claim_token = models.UUIDField(null=True, editable=False)

    class Meta:
        verbose_name = "Уведомление Telegram"
        verbose_name_plural = "Уведомления Telegram"
