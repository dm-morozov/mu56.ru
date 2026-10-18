/** Match the names visitors see, ignoring common typing differences. */
export function normalizeCharacterSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();
}

export function matchesCharacterSearch(name: string, query: string): boolean {
  const words = normalizeCharacterSearch(query).split(" ").filter(Boolean);
  const normalizedName = normalizeCharacterSearch(name);
  return words.every(word => normalizedName.includes(word));
}
