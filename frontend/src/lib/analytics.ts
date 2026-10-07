// Only public catalogue identifiers and fixed enums may reach the analytics service.
export const METRIKA_ID = 105020810;
export const ANALYTICS_CHOICE = "mu56-analytics-v1";
export const goals = {
  form_open: "Форма: открыли", form_start: "Форма: начали заполнять",
  form_progress: "Форма: взаимодействие с полями",
  contact_ready: "Форма: телефон заполнен", details_open: "Форма: раскрыли детали",
  program_select: "Форма: выбрали программу", hero_select: "Форма: выбрали героя",
  form_submit: "Форма: попытка отправки", validation_error: "Форма: проверьте поле",
  submit_error: "Форма: ошибка отправки", lead_success: "Заявка сохранена",
  form_abandon: "Форма: закрыли без отправки", contact_click: "Контакт: переход",
  catalog_search: "Каталог: поиск", catalog_filter: "Каталог: порядок и категория",
  media_interact: "Медиа: просмотр",
} as const;
export type Goal = keyof typeof goals;
export type AnalyticsParams = Record<string, string | number | boolean>;
type Ym = ((id: number, method: string, ...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
declare global { interface Window { ym?: Ym; mu56AnalyticsReady?: boolean } }
const enums: Record<string, readonly string[]> = {
  field: ["name", "phone", "contact_method", "event_date", "event_time", "offering", "hero", "second_hero", "second_performer", "comment", "data_consent", "details", "addons", "tariff", "unknown"],
  reason: ["close", "pagehide", "network", "timeout", "csrf", "rate_limit", "server", "validation", "unknown"],
  channel: ["phone", "telegram", "max", "vk", "avito", "instagram", "other"],
  action: ["open", "play", "complete", "next", "previous", "filter", "sort", "select", "change"],
  kind: ["animation", "transformer", "package", "show", "extra", "seasonal", "unknown"],
  sort: ["category", "popular", "name"],
  price_band: ["unknown", "under_5000", "5000_9999", "10000_14999", "15000_plus"],
};
export function safePath(path: string): string | null {
  const clean = path.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return /^(\/|\/(animators|transformers|packages|characters|shows|extras|new-year|gallery|contacts|reviews|articles|holidays)(\/[a-z-]{1,70})?)$/.test(clean) ? clean : null;
}
export function safeParams(params: AnalyticsParams): AnalyticsParams {
  const safe: AnalyticsParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (enums[key]?.includes(String(value))) safe[key] = value;
    else if (["program", "hero", "addon", "media"].includes(key) && typeof value === "string" && /^[a-z-]{1,70}$/.test(value)) safe[key] = value;
    else if (["seconds", "results", "addon_count", "attempt", "status", "category_index"].includes(key) && typeof value === "number" && Number.isFinite(value)) safe[key] = Math.max(0, Math.min(3600, Math.round(value)));
    else if (["started", "phone_ready", "details", "selected", "checked", "resumed"].includes(key) && typeof value === "boolean") safe[key] = value;
  }
  return safe;
}
export function analyticsAllowed(): boolean {
  try { return window.location.hostname === "mu56.ru" && localStorage.getItem(ANALYTICS_CHOICE) === "accepted" && window.mu56AnalyticsReady === true; } catch { return false; }
}
export function track(goal: Goal, params: AnalyticsParams = {}): boolean {
  if (typeof window === "undefined" || !analyticsAllowed() || !window.ym || !(goal in goals)) return false;
  const page = safePath(window.location.pathname);
  if (!page) return false;
  try { window.ym(METRIKA_ID, "reachGoal", goal, { ...safeParams(params), page, schema: "v1" }); return true; } catch { return false; }
}
export function priceBand(amount?: number): string {
  return amount === undefined ? "unknown" : amount < 5000 ? "under_5000" : amount < 10000 ? "5000_9999" : amount < 15000 ? "10000_14999" : "15000_plus";
}
