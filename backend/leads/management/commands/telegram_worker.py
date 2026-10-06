import time

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections
from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_aware

from leads.notifications import configured, process_one


class Command(BaseCommand):
    help = "Отправляет сохранённые уведомления Telegram; --once обрабатывает очередь один раз."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--created-after", help="ISO-время с часовым поясом: отправлять только новые заявки после восстановления базы.")

    def handle(self, *args, **options):
        if not configured():
            raise CommandError("Telegram выключен или не настроен. Выполните configure_telegram.")
        created_after = None
        if options["created_after"]:
            try:
                created_after = parse_datetime(options["created_after"])
            except ValueError:
                created_after = None
            if created_after is None or not is_aware(created_after):
                raise CommandError("Укажите ISO-время с часовым поясом для --created-after.")
        self.stdout.write("Обработчик Telegram запущен. Ctrl+C — остановить.")
        try:
            while True:
                close_old_connections()
                processed = process_one(created_after=created_after)
                if not processed:
                    if options["once"]:
                        return
                    time.sleep(3)
        except KeyboardInterrupt:
            self.stdout.write("Обработчик остановлен.")
