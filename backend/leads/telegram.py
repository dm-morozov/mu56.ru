"""Telegram transport. Never persist remote descriptions or token-bearing exceptions."""
import json
import re
from http.client import HTTPException, HTTPSConnection
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler, HTTPSHandler


class TelegramError(Exception):
    def __init__(self, reason, *, retry_after=None, uncertain=False):
        super().__init__(reason)
        self.retry_after = retry_after
        self.uncertain = uncertain


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Do not forward the bot token to a redirected host.


class ConnectionNotEstablished(OSError):
    """No Telegram HTTP request has been written; retry cannot duplicate it."""


class TelegramHTTPSConnection(HTTPSConnection):
    def connect(self):
        # DNS, TCP, proxy tunnel and TLS all finish before HTTP sends the POST.
        try:
            super().connect()
        except (OSError, HTTPException):
            self.close()
            raise ConnectionNotEstablished("Telegram connection failed") from None


class TelegramHTTPSHandler(HTTPSHandler):
    def https_open(self, request):
        return self.do_open(TelegramHTTPSConnection, request,
                            context=self._context)


def bot_request(token, method, payload=None):
    if not re.fullmatch(r"\d+:[A-Za-z0-9_-]+", token):
        raise TelegramError("Некорректный токен бота")
    if method not in {"getMe", "getWebhookInfo", "getUpdates", "getChat", "sendMessage"}:
        raise ValueError("Unsupported Telegram method")
    request = Request(f"https://api.telegram.org/bot{token}/{method}",
                      data=json.dumps(payload or {}).encode("utf-8"),
                      headers={"Content-Type": "application/json"}, method="POST")
    try:
        with build_opener(NoRedirect(), TelegramHTTPSHandler()).open(request, timeout=10) as response:
            body = response.read(1024 * 1024)
    except HTTPError as error:
        try:
            data = json.loads(error.read(64 * 1024))
        except (ValueError, OSError):
            data = {}
        raise api_error(error.code, data) from None
    except URLError as error:
        if isinstance(error.reason, ConnectionNotEstablished):
            raise TelegramError("Соединение с Telegram не установлено", retry_after=60) from None
        raise TelegramError("Нет подтверждения от Telegram: ошибка сети", uncertain=True) from None
    except ConnectionNotEstablished:
        raise TelegramError("Соединение с Telegram не установлено", retry_after=60) from None
    except (TimeoutError, OSError, HTTPException):
        raise TelegramError("Нет подтверждения от Telegram: ошибка сети", uncertain=True) from None
    try:
        data = json.loads(body)
        if not isinstance(data, dict):
            raise ValueError
    except ValueError:
        raise TelegramError("Нераспознанный ответ Telegram", uncertain=True) from None
    if not data.get("ok"):
        raise api_error(data.get("error_code", 0), data)
    return data.get("result")


def api_error(code, data):
    parameters = data.get("parameters", {}) if isinstance(data, dict) else {}
    if not isinstance(parameters, dict):
        parameters = {}
    if code == 429:
        wait = parameters.get("retry_after", 60)
        return TelegramError("Telegram ограничил частоту отправки", retry_after=max(1, int(wait)) if isinstance(wait, (int, float)) else 60)
    if isinstance(code, int) and code >= 500:
        return TelegramError("Telegram временно недоступен", retry_after=60)
    return TelegramError({400: "Telegram отклонил сообщение или адрес чата", 401: "Токен Telegram недействителен", 403: "Бот заблокирован или не имеет доступа к чату", 409: "Бот уже используется другим обработчиком"}.get(code, "Telegram отклонил запрос"))


def notification_payload(lead, chat_id):
    snapshot = lead.selection_snapshot
    def clean(value, limit=250):
        return str(value or "").replace("\r", " ")[:limit]
    lines = ["Мир Улыбок · новая заявка", f"№ {lead.pk}", "", f"Имя: {clean(lead.name) or 'Не указано'}", f"Телефон: {lead.phone}", f"Связаться: {lead.get_contact_method_display()}"]
    if lead.messenger_handle:
        lines.append(f"Контакт: {clean(lead.messenger_handle)}")
    lines.append(f"Дата: {lead.event_date.strftime('%d.%m.%Y') if lead.event_date else 'Уточнить'}")
    if lead.event_time:
        lines.append(f"Время: {lead.event_time.strftime('%H:%M')} (Оренбург)")
    lines.append(f"Программа: {clean((snapshot.get('offering') or {}).get('name')) or 'Помочь выбрать'}")
    if snapshot.get("character"):
        label = "Второй герой" if (snapshot.get("offering") or {}).get("kind") == "transformer" else "Герой"
        lines.append(f"{label}: {clean(snapshot['character'].get('name'))}")
    if snapshot.get("second_character"):
        lines.append(f"Второй герой: {clean(snapshot['second_character'].get('name'))}")
    if snapshot.get("addons"):
        lines.append("Дополнения: " + clean(", ".join(item.get("name", "") for item in snapshot["addons"]), 500))
    if snapshot.get("second_performer"):
        lines.append("Второй аниматор: да")
    for item in snapshot.get("price_breakdown", []):
        lines.append(f"{clean(item['name'])}: {item['amount_rub']:,} ₽".replace(",", " "))
    if lead.child_age:
        lines.append(f"Возраст: {lead.child_age}")
    if lead.children_count:
        lines.append(f"Детей: {lead.children_count}")
    if lead.location:
        lines.append(f"Место: {clean(lead.location, 300)}")
    amount = snapshot.get("known_program_amount_rub")
    if amount is not None:
        lines.append(f"Предварительный расчёт: {amount:,} ₽".replace(",", " "))
    lines.append("Состав, итоговую цену и выезд согласовать с клиентом.")
    if lead.comment:
        lines.extend(["", "Пожелания:", clean(lead.comment, 1800)])
    # Plain text: user input cannot introduce Telegram markup. Bound UTF-16 too.
    text = "\n".join(lines).encode("utf-16-le")[:7800].decode("utf-16-le", errors="ignore")
    return {"chat_id": chat_id, "text": text, "link_preview_options": {"is_disabled": True}}
