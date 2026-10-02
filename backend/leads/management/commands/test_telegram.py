from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from leads.notifications import configured
from leads.telegram import TelegramError, bot_request


class Command(BaseCommand):
    help = "Отправляет одно тестовое сообщение владельцу, без данных клиентов."

    def handle(self, *args, **options):
        if not configured():
            raise CommandError("Telegram не настроен.")
        try:
            result = bot_request(settings.TELEGRAM_BOT_TOKEN, "sendMessage", {"chat_id": settings.TELEGRAM_CHAT_ID, "text": "Мир Улыбок · проверка связи\nБот подключён. Новые заявки будут приходить сюда, когда запущен обработчик уведомлений.", "link_preview_options": {"is_disabled": True}})
            if not isinstance(result, dict) or not isinstance(result.get("message_id"), int):
                raise TelegramError("Telegram не подтвердил сообщение", uncertain=True)
        except TelegramError as error:
            raise CommandError(str(error)) from None
        self.stdout.write("Telegram подтвердил отправку. Проверьте получение сообщения в своём чате.")
