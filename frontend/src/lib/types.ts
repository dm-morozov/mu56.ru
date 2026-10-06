export type CharacterPhoto = { url: string; alt: string; position: number };
export type Character = { slug: string; name: string; category: string; description: string; availability: string; availability_label: string; photos: CharacterPhoto[] };
export type Price = { code: string; label: string; context: string; amount_rub: number; duration_minutes: number | null };
export type Part = { position: number; title: string; duration_minutes: number; is_approximate: boolean; led_by_performer: boolean; service_slug: string | null };
export type Offering = { slug: string; name: string; kind: string; service_position: number | null; description: string; duration_minutes: number | null; duration_is_approximate: boolean; included_performers: number; availability: string; availability_label: string; requirements: string; prices: Price[]; characters: Character[]; parts: Part[] };
export const rubles = (amount: number) => new Intl.NumberFormat("ru-RU").format(amount) + " ₽";
export const basePrice = (item: Offering) => item.prices.find(p => p.context === "base")?.amount_rub;
export const twoPerformerShowPrice = (show: Offering) => {
  const addon = show.prices.find(p => p.context === "with_animation");
  const support = show.prices.find(p => p.context === "transformer_support");
  return addon && support ? addon.amount_rub + support.amount_rub : undefined;
};
export function duration(minutes: number | null): string {
  if (!minutes) return "Время согласуем";
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return [hours ? `${hours} ч` : "", rest ? `${rest} мин` : ""].filter(Boolean).join(" ");
}
