from django import forms
from catalog.models import Offering
from .models import Lead
from .selection import allowed_characters, character_error


class LeadAdminForm(forms.ModelForm):
    class Meta:
        model = Lead
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        offering = self.instance.offering if self.instance.offering_id else None
        if self.is_bound:
            offering = Offering.objects.filter(pk=self.data.get("offering")).first() if self.data.get("offering", "").isdigit() else None
        field = self.fields.get("character")
        if field:
            field.label = "Второй герой (обычный костюм)" if offering and offering.kind == Offering.Kind.TRANSFORMER else "Герой анимации"
            field.help_text = "В программе трансформеров большой герой определяется основной программой, здесь выбирается его напарник. Можно оставить пустым и согласовать позже."
            if offering:
                allowed = allowed_characters(offering)
                # Display old invalid selections so staff can deliberately correct them.
                if not self.is_bound and self.instance.character_id and character_error(offering, self.instance.character):
                    allowed = allowed | field.queryset.filter(pk=self.instance.character_id)
                    field.help_text = "Текущий герой несовместим с программой. Выберите подходящего героя или оставьте поле пустым. " + field.help_text
                field.queryset = allowed

    def clean(self):
        cleaned = super().clean()
        offering, character = cleaned.get("offering"), cleaned.get("character")
        error = character_error(offering, character)
        if error:
            self.add_error("character", error)
        if cleaned.get("second_performer") and (not offering or offering.kind != Offering.Kind.PACKAGE):
            self.add_error("second_performer", "Доплата второго ведущего выбирается только в обычном пакете. В трансформерах два участника уже входят в цену.")
        return cleaned
