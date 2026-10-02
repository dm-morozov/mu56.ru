import getpass
import json
import os
import secrets

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from leads.telegram import TelegramError, bot_request


class Command(BaseCommand):
    help = "Интерактивно привязывает отдельного бота к личному чату владельца. Токен скрыт при вводе."

    def add_arguments(self, parser):
        parser.add_argument("--existing", action="store_true", help="Указать свой chat ID без чтения getUpdates существующего бота.")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("На сервере задайте TELEGRAM_* через окружение; мастер предназначен для локальной разработки.")
        target = settings.BASE_DIR.parent / ".local" / "telegram.json"
        if target.exists() and input("Локальная настройка уже есть. Заменить? [да/нет]: ").strip().lower() != "да":
            return
        token = getpass.getpass("Токен от BotFather (ввод скрыт): ").strip()
        try:
            bot = bot_request(token, "getMe")
            if not isinstance(bot, dict) or not bot.get("is_bot"):
                raise CommandError("Telegram не подтвердил бота.")
            self.stdout.write(f"Бот: @{bot['username']}")
            if options["existing"]:
                value = input("Ваш личный числовой chat ID: ").strip()
                if not value.isdecimal() or int(value) <= 0:
                    raise CommandError("Нужен положительный ID личного чата.")
                chat_id = int(value)
                chat = bot_request(token, "getChat", {"chat_id": chat_id})
                if not isinstance(chat, dict) or chat.get("type") != "private":
                    raise CommandError("Для заявок нужен личный чат владельца.")
                self.stdout.write(f"Получатель: {chat.get('first_name', '')} @{chat.get('username', 'без username')}")
            else:
                webhook = bot_request(token, "getWebhookInfo")
                if not isinstance(webhook, dict) or webhook.get("url"):
                    raise CommandError("У бота уже настроен webhook. Он не изменён. Используйте отдельного бота или --existing.")
                nonce = secrets.token_urlsafe(18)
                self.stdout.write("Откройте ссылку своим Telegram-аккаунтом и нажмите START:")
                self.stdout.write(f"https://t.me/{bot['username']}?start={nonce}")
                matches = []
                while not matches:
                    if input("После START нажмите Enter для проверки (q — отмена): ").strip().lower() == "q":
                        self.stdout.write("Настройка не сохранена.")
                        return
                    updates = bot_request(token, "getUpdates", {"timeout": 5, "limit": 100})
                    for update in updates if isinstance(updates, list) else []:
                        message = update.get("message", {})
                        chat = message.get("chat", {})
                        if message.get("text", "").split() == ["/start", nonce] and chat.get("type") == "private" and chat.get("id") == message.get("from", {}).get("id"):
                            matches.append(chat)
                    if not matches:
                        self.stdout.write("Нужное сообщение пока не получено. Мастер остаётся открытым, ссылка не меняется.")
                        self.stdout.write("Откройте именно ссылку выше и нажмите START. Если кнопки нет, отправьте боту:")
                        self.stdout.write(f"/start {nonce}")
                chat_id = matches[-1]["id"]
                self.stdout.write(f"Получатель: {matches[-1].get('first_name', '')} @{matches[-1].get('username', 'без username')}")
            if input("Это ваш чат для заявок сайта? [да/нет]: ").strip().lower() != "да":
                self.stdout.write("Настройка не сохранена.")
                return
            target.parent.mkdir(exist_ok=True)
            temporary = target.with_suffix(".tmp")
            with temporary.open("w", encoding="utf-8") as output:
                json.dump({"enabled": True, "bot_token": token, "chat_id": chat_id}, output)
            os.replace(temporary, target)
            self.stdout.write("Настройка сохранена в .local/telegram.json. Перезапустите Django, затем выполните test_telegram и telegram_worker.")
        except TelegramError as error:
            raise CommandError(str(error)) from None
