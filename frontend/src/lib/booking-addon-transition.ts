import type { Offering } from "./types";

// Keep only choices usable by the new program. Included services are not extras.
export function compatibleBookingAddons(
  selected: readonly string[], next: Offering | undefined, catalog: readonly Offering[], tariff = "",
): string[] {
  if (!next || next.availability === "unavailable") return [];
  const included = new Set(next.parts.map(part => part.service_slug).filter(Boolean));
  const priced = (item: Offering, context: string) => item.prices.some(price => price.context === context);
  const kept = [...new Set(selected)].filter(slug => {
    if (slug === next.slug || included.has(slug)) return false;
    const item = catalog.find(offering => offering.slug === slug);
    if (!item || item.availability === "unavailable") return false;
    if (item.kind === "extra" && ["sound", "photographer"].includes(slug)) return true;
    if (item.kind !== "show") return false;
    if (next.kind === "animation") return priced(item, "with_animation") || priced(item, "base");
    if (next.kind === "transformer") return priced(item, "with_animation") && priced(item, "transformer_support");
    if (next.kind === "seasonal") {
      if (/^(eve|night)-/.test(tariff)) return false;
      return ["nitrogen", "silver", "cotton-candy-show"].includes(slug)
        && priced(item, "with_animation") && priced(item, "transformer_support");
    }
    return false;
  });
  const soundIncluded = next.slug === "foam" || included.has("foam") || included.has("sound")
    || kept.includes("foam") || (next.kind === "seasonal" && tariff === "group-with-sound");
  return soundIncluded ? kept.filter(slug => slug !== "sound") : kept;
}
