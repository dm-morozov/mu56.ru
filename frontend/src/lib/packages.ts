import { basePrice, type Offering } from "./types";

/** Prices come from the catalog; foam packages already include sound. */
export function packagePrice(item: Offering, offerings: Offering[], includeSound = false) {
  const base = basePrice(item);
  const soundAlreadyIncluded = item.parts.some(part => part.service_slug === "foam" || part.service_slug === "sound");
  const addonSound = includeSound && !soundAlreadyIncluded;
  const sound = offerings.find(offering => offering.slug === "sound");
  const soundPrice = sound && basePrice(sound);
  return {
    base,
    addonSound,
    soundPrice: addonSound ? soundPrice : 0,
    total: addonSound ? (base !== undefined && soundPrice !== undefined ? base + soundPrice : undefined) : base,
  };
}

const packageOrder = ["full-party", "ice-breath", "sweet-vibe", "silver-party", "foam-party"];
export function sortPackages(items: Offering[]) {
  const rank = (slug: string) => { const index = packageOrder.indexOf(slug); return index < 0 ? packageOrder.length : index; };
  return [...items].sort((a, b) => rank(a.slug) - rank(b.slug));
}
export function packageTiming(item: Offering) {
  const active = item.parts.filter(part => part.led_by_performer);
  return {
    active: active.reduce((sum, part) => sum + part.duration_minutes, 0),
    approximate: active.some(part => part.is_approximate),
    background: item.parts.filter(part => !part.led_by_performer).reduce((sum, part) => sum + part.duration_minutes, 0),
  };
}
