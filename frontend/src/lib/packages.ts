import type { Offering } from "./types";

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
