import type { Offering } from "./types";

// Describe the service in search while keeping the catalogue's product name in the UI.
const searchTitles: Record<string, string> = {
  bumblebee: "Бамблби на праздник — два героя",
  "optimus-prime": "Оптимус Прайм на праздник — два героя",
  "iron-man": "Железный человек на праздник — два героя",
  "ice-breath": "Аниматор и азотное шоу — Ледяное дыхание",
  "full-party": "Аниматор, азотное шоу и сладкая вата — Полный Расколбас",
  "sweet-vibe": "Аниматор и шоу сладкой ваты — Сладкий вайб",
  "silver-party": "Аниматор и серебряное шоу — Серебряное пати",
  "foam-party": "Аниматор и пенная вечеринка — Запеним все!!!",
};

export function offeringSearchTitle(item: Offering): string {
  return searchTitles[item.slug] || `${item.name} на праздник`;
}

export function offeringSearchDescription(item: Offering): string {
  const composition = item.kind === "package"
    ? item.parts.filter(part => part.led_by_performer).map(part => part.title).join(", ")
    : item.kind === "transformer"
      ? "Большой герой и второй персонаж в обычном костюме"
      : item.description;
  return `${item.name} в Оренбурге. ${composition || "Выездная программа на вашей площадке"}. Состав и цены на странице; дату и выезд согласуем до праздника.`;
}
