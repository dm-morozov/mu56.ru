import json

from django.contrib import admin, messages
from django.db import transaction
from django.utils.html import format_html
from django.http import JsonResponse
from django.urls import path, reverse
from catalog.models import Offering

from .models import Lead, TelegramNotification
from .notifications import retry_notifications
from .forms import LeadAdminForm
from .selection import allowed_characters


class TelegramInline(admin.StackedInline):
    model = TelegramNotification
    extra = 0
    can_delete = False
    fields = ("status", "attempts", "next_attempt_at", "started_at", "sent_at", "message_id", "last_error")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


class WorkFilter(admin.SimpleListFilter):
    title = "Работа с заявкой"
    parameter_name = "work"

    def lookups(self, request, model_admin):
        return [("open", "В работе"), ("new", "Ждут первого контакта"), ("closed", "Завершённые")]

    def queryset(self, request, queryset):
        groups = {
            "open": [Lead.Status.NEW, Lead.Status.CONTACTED, Lead.Status.PROPOSAL],
            "new": [Lead.Status.NEW],
            "closed": [Lead.Status.CONFIRMED, Lead.Status.CANCELLED],
        }
        return queryset.filter(status__in=groups[self.value()]) if self.value() in groups else queryset


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    form = LeadAdminForm

    class Media:
        js = ("leads/admin-selection.js",)

    def get_urls(self):
        return [path("character-choices/", self.admin_site.admin_view(self.character_choices), name="leads_lead_character_choices")] + super().get_urls()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        field = super().formfield_for_foreignkey(db_field, request, **kwargs)
        if db_field.name == "character":
            field.widget.attrs["data-choices-url"] = reverse("admin:leads_lead_character_choices")
        return field

    def character_choices(self, request):
        if not self.has_change_permission(request):
            return JsonResponse({"detail": "Нет права изменения заявок."}, status=403)
        if request.method != "GET":
            return JsonResponse({"detail": "Разрешён только GET."}, status=405)
        value = request.GET.get("offering", "")
        offering = None
        if value:
            if not value.isascii() or not value.isdigit() or len(value) > 19 or int(value) > 9223372036854775807:
                return JsonResponse({"detail": "Программа не найдена."}, status=400)
            offering = Offering.objects.filter(pk=value).first()
            if offering is None:
                return JsonResponse({"detail": "Программа не найдена."}, status=400)
        transformer = offering and offering.kind == Offering.Kind.TRANSFORMER
        return JsonResponse({
            "choices": list(allowed_characters(offering).values("id", "name")),
            "label": "Второй герой (обычный костюм)" if transformer else "Герой анимации",
            "primary_hero": {"bumblebee": "Бамблби", "optimus-prime": "Оптимус", "iron-man": "Железный человек"}.get(offering.slug, offering.name) if transformer else "Выбирается основной программой трансформеров; в обычных пакетах — герой анимации.",
            "second_performer_allowed": bool(offering and offering.kind == Offering.Kind.PACKAGE),
        })
    list_display = ("created_at", "client_summary", "offering", "event_date", "estimated_amount", "status", "notification_status")
    list_display_links = ("created_at", "client_summary")
    list_filter = (WorkFilter, "status", "contact_method", "event_date", "telegram_notification__status")
    search_fields = ("name", "phone", "location", "comment", "manager_notes", "messenger_handle")
    search_help_text = "Имя, телефон, место, пожелания или заметка менеджера"
    list_select_related = ("offering",)
    list_per_page = 30
    date_hierarchy = "created_at"
    list_editable = ("status",)
    readonly_fields = ("id", "created_at", "snapshot_summary", "snapshot_json", "call_client", "consent_at", "consent_version", "notification_status", "primary_hero")
    fieldsets = (
        ("Работа с заявкой", {"fields": ("status", "manager_notes", "notification_status")}),
        ("Клиент и связь", {"fields": ("name", "phone", "call_client", "contact_method", "messenger_handle")}),
        ("Праздник", {"fields": (("event_date", "event_time"), ("child_age", "children_count"), "location", "comment")}),
        ("Программа после обсуждения", {"fields": ("offering", "primary_hero", "character", "addons", "second_performer"), "description": "В трансформерах основная программа выбирает большого героя и цену, а поле героя — второго участника в обычном костюме. Несколько больших героев обсуждаются отдельно через пожелания/заметки. Исходный состав и тарифы ниже сохраняются; правки не пересчитывают первоначальную сумму и не отправляют новое уведомление."}),
        ("Исходная заявка и предварительный расчёт", {"fields": ("snapshot_summary",)}),
        ("Служебные данные", {"fields": ("id", "created_at", "consent_at", "consent_version", "snapshot_json"), "classes": ("collapse",)}),
    )
    autocomplete_fields = ("offering", "addons")
    inlines = [TelegramInline]
    actions = ["mark_contacted", "mark_proposal", "mark_confirmed", "mark_cancelled", "retry_telegram"]

    @admin.display(description="Клиент")
    def client_summary(self, obj):
        return format_html('{}<br><span style="font-weight:normal">{} · {}</span>', obj.name or "Имя не указано", obj.phone, obj.get_contact_method_display())

    @admin.display(description="Расчёт при обращении")
    def estimated_amount(self, obj):
        amount = obj.selection_snapshot.get("known_program_amount_rub")
        return f"{amount:,} ₽".replace(",", " ") if amount is not None else "Нужно уточнить"

    @admin.display(description="Позвонить")
    def call_client(self, obj):
        return format_html('<a href="tel:{}">Позвонить {}</a>', obj.phone, obj.phone)

    @admin.display(description="Большой герой программы")
    def primary_hero(self, obj):
        if obj.offering and obj.offering.kind == "transformer":
            return {"bumblebee": "Бамблби", "optimus-prime": "Оптимус", "iron-man": "Железный человек"}.get(obj.offering.slug, obj.offering.name)
        return "Выбирается основной программой трансформеров; в обычных пакетах — герой анимации."

    @admin.display(description="Состав на момент обращения")
    def snapshot_summary(self, obj):
        snapshot = obj.selection_snapshot
        lines = ["Программа: " + ((snapshot.get("offering") or {}).get("name") or "Помочь выбрать")]
        if snapshot.get("character"):
            label = "Второй герой: " if (snapshot.get("offering") or {}).get("kind") == "transformer" else "Герой: "
            lines.append(label + snapshot["character"].get("name", ""))
        if snapshot.get("addons"):
            lines.append("Дополнения: " + ", ".join(item.get("name", "") for item in snapshot["addons"]))
        if snapshot.get("second_performer"):
            lines.append("Второй аниматор: да")
        for item in snapshot.get("price_breakdown", []):
            lines.append(f"{item['name']}: {item['amount_rub']:,} ₽".replace(",", " "))
        lines.extend(["Предварительный расчёт: " + self.estimated_amount(obj), "Итоговую стоимость, состав и выезд нужно согласовать."])
        return format_html('<div style="white-space:pre-wrap;line-height:1.8">{}</div>', "\n".join(lines))

    @admin.display(description="Исходный снимок тарифов")
    def snapshot_json(self, obj):
        return format_html('<pre style="white-space:pre-wrap;overflow-wrap:anywhere">{}</pre>', json.dumps(obj.selection_snapshot, ensure_ascii=False, indent=2))

    @transaction.atomic
    def set_work_status(self, request, queryset, status):
        count = 0
        for lead in queryset.select_for_update(of=("self",)).exclude(status=status):
            previous = lead.get_status_display()
            lead.status = status
            lead.save(update_fields=["status"])
            self.log_change(request, lead, f"Статус: {previous} → {lead.get_status_display()}")
            count += 1
        self.message_user(request, f"Обновлено заявок: {count}. Статус: {Lead.Status(status).label}.", messages.SUCCESS)

    @admin.action(description="Отметить: связались с клиентом", permissions=["change"])
    def mark_contacted(self, request, queryset):
        self.set_work_status(request, queryset, Lead.Status.CONTACTED)

    @admin.action(description="Отметить: обсуждаем программу", permissions=["change"])
    def mark_proposal(self, request, queryset):
        self.set_work_status(request, queryset, Lead.Status.PROPOSAL)

    @admin.action(description="Отметить: заказ согласован", permissions=["change"])
    def mark_confirmed(self, request, queryset):
        self.set_work_status(request, queryset, Lead.Status.CONFIRMED)

    @admin.action(description="Закрыть без заказа", permissions=["change"])
    def mark_cancelled(self, request, queryset):
        self.set_work_status(request, queryset, Lead.Status.CANCELLED)

    @admin.action(description="Повторить неудачные уведомления (сначала проверьте Telegram)", permissions=["change"])
    def retry_telegram(self, request, queryset):
        count = retry_notifications(queryset.values_list("pk", flat=True))
        self.message_user(request, f"В очередь возвращено: {count}. Уже отправленные уведомления не повторяются.", messages.SUCCESS)

    def has_add_permission(self, request):
        return False  # Public intake records a consent timestamp and a price snapshot.
