import time

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections

from leads.notifications import configured, process_one


class Command(BaseCommand):
    help = "Отправляет сохранённые уведомления Telegram; --once обрабатывает очередь один раз."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")

    def handle(self, *args, **options):
        if not configured():
            raise CommandError("Telegram выключен или не настроен. Выполните configure_telegram.")
        self.stdout.write("Обработчик Telegram запущен. Ctrl+C — остановить.")
        try:
            while True:
                close_old_connections()
                processed = process_one()
                if not processed:
                    if options["once"]:
                        return
                    time.sleep(3)
        except KeyboardInterrupt:
            self.stdout.write("Обработчик остановлен.")
