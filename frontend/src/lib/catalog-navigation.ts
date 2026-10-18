// This state belongs to one browser history entry, not to the whole tab/session.
// Never put search text in URLs, analytics, cookies or persistent web storage.
export const CATALOG_HISTORY_KEY = "mu56Catalog";
export const CATALOG_ALL = "Все герои";
export type CatalogSort = "category" | "popular" | "name";
export type CatalogFilters = { search: string; category: string; sortOrder: CatalogSort };
export type CatalogPosition = { x: number; y: number };
export type CatalogNavigation = CatalogFilters & { version: 1; position: CatalogPosition | null };
export const DEFAULT_CATALOG_FILTERS: CatalogFilters = { search: "", category: CATALOG_ALL, sortOrder: "category" };
const MAX_SAVED_SEARCH = 1024;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10_000_000;

export function readCatalogNavigation(historyState: unknown, categories: readonly string[]): CatalogNavigation | null {
  const saved = isRecord(historyState) ? historyState[CATALOG_HISTORY_KEY] : null;
  if (!isRecord(saved) || saved.version !== 1) return null;
  const position = isRecord(saved.position) && isCoordinate(saved.position.x) && isCoordinate(saved.position.y)
    ? { x: saved.position.x, y: saved.position.y } : null;
  return {
    version: 1,
    search: typeof saved.search === "string" && saved.search.length <= MAX_SAVED_SEARCH ? saved.search : "",
    category: typeof saved.category === "string" && categories.includes(saved.category) ? saved.category : CATALOG_ALL,
    sortOrder: saved.sortOrder === "popular" || saved.sortOrder === "name" ? saved.sortOrder : "category",
    position,
  };
}

export function saveCatalogNavigation(history: Pick<History, "state" | "replaceState">, filters: CatalogFilters, position: CatalogPosition): boolean {
  try {
    // Very long pasted input still filters normally, but is not retained in history.
    const saved: CatalogNavigation = { ...filters, search: filters.search.length <= MAX_SAVED_SEARCH ? filters.search : "", version: 1, position };
    const current = isRecord(history.state) ? history.state : {};
    const previous = current[CATALOG_HISTORY_KEY];
    if (isRecord(previous) && previous.version === 1 && previous.search === saved.search && previous.category === saved.category && previous.sortOrder === saved.sortOrder
      && isRecord(previous.position) && previous.position.x === position.x && previous.position.y === position.y) return true;
    // Keep every framework/other consumer key. Omit the URL argument: this is a
    // state-only update, with no router navigation, fetch, scroll or new Back entry.
    history.replaceState({ ...current, [CATALOG_HISTORY_KEY]: saved }, "");
    return true;
  } catch {
    // Browser history quotas/restrictions must not make the controls unusable.
    return false;
  }
}
