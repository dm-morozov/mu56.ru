import type { Character, Offering } from "./types";

export type BookingCatalog = {
  characters: Character[];
  offerings: (Omit<Offering, "characters"> & { characterSlugs: string[] })[];
};

// A hero can belong to many programs. Send their details once, keeping each
// program's compatible heroes and their order as references.
export function bookingCatalog(offerings: Offering[]): BookingCatalog {
  const characters = new Map<string, Character>();
  return {
    offerings: offerings.map(({ characters: heroes, ...offering }) => {
      heroes.forEach(hero => characters.set(hero.slug, hero));
      return { ...offering, characterSlugs: heroes.map(hero => hero.slug) };
    }),
    characters: Array.from(characters.values()),
  };
}

export function bookingOfferings(catalog: BookingCatalog): Offering[] {
  const characters = new Map(catalog.characters.map(hero => [hero.slug, hero]));
  return catalog.offerings.map(({ characterSlugs, ...offering }) => ({
    ...offering,
    characters: characterSlugs.map(slug => {
      const hero = characters.get(slug);
      if (!hero) throw new Error(`Missing booking character: ${slug}`);
      return hero;
    }),
  }));
}
