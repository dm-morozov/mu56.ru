import type { Character, CharacterSummary, Offering } from "./types";

// The form needs identity, filtering and availability, not gallery/page content.
export type BookingCharacter = CharacterSummary;
export type BookingOffering = Omit<Offering, "characters"> & { characters: BookingCharacter[] };

export type BookingCatalog = {
  characters: BookingCharacter[];
  offerings: (Omit<Offering, "characters"> & { characterSlugs: string[] })[];
};

// Reused by the /characters server-to-client boundary. Never fabricate empty
// descriptions/photos to make a summary look like a full detail-page character.
export function characterSummary({ slug, name, category, availability }: Character): CharacterSummary {
  return { slug, name, category, availability };
}

// Send each hero's booking fields once. Keep every offering field and its
// compatible heroes in their original order; full characters stay on the server.
export function bookingCatalog(offerings: readonly Offering[]): BookingCatalog {
  const characters = new Map<string, BookingCharacter>();
  return {
    offerings: offerings.map(({ characters: heroes, ...offering }) => {
      heroes.forEach(hero => characters.set(hero.slug, characterSummary(hero)));
      return { ...offering, characterSlugs: heroes.map(hero => hero.slug) };
    }),
    characters: Array.from(characters.values()),
  };
}

export function bookingOfferings(catalog: BookingCatalog): BookingOffering[] {
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
