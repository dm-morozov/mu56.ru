// Descriptions verified against the archive images; no event or venue is inferred.
const descriptions: Record<string, string> = {
  "0ed831177d524aafaef6add9b7631821.webp": "Дед Мороз и Снегурочка в полный рост, с раскрытыми руками возле зеркала",
  "b3976bd50aa042a689f17d4e6d83be58.webp": "Дед Мороз поднимает варежку, Снегурочка позирует рядом возле зеркала",
};

export function archivePhotoDescription(url: string, fallback: string): string {
  return descriptions[url.split("/").pop() || ""] || fallback;
}
