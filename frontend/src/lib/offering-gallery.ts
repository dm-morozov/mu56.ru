import type { CharacterPhoto } from "./types";

// One registry for galleries of services and packages. Character photos come from the API.
export const offeringGalleries: Record<string, CharacterPhoto[]> = {
  pinata: [
    { url: "/media/gallery/pinata/birthday-game-cropped.webp", alt: "Пиньята и именинница: игра начинается", position: 1 },
    { url: "/media/gallery/pinata/candy-finale-racer.webp", alt: "Сладкий финал — дети ловят сюрпризы из пиньяты", position: 2 },
    { url: "/media/gallery/pinata/party-game.webp", alt: "Игра с пиньятой на детском празднике", position: 3 },
    { url: "/media/gallery/pinata/yellow-pinata-balanced.webp", alt: "Яркая пиньята и маленькая участница праздника", position: 4 },
  ],
};
