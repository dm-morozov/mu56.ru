import { characterPortraits } from "./character-images";
export function characterImage(slug: string) {
  if (slug === "graduation-host") return "/media/dmitry-morozov-host.webp";
  if (slug === "new-year-duo" || slug === "new-year") return "/media/new-year/duo-studio.jpg";
  if (characterPortraits[slug]) return characterPortraits[slug];
  return ({ bumblebee: "/media/bumblebee-party-studio.jpg", "optimus-prime": "/media/optimus-prime-bright-room.jpg", "iron-man": "/media/iron-man-superman-bright.jpg" } as Record<string, string>)[slug];
}
export function characterIsPhoto(slug: string) {
  return ["bumblebee", "optimus-prime", "iron-man", "new-year-duo", "new-year", "graduation-host"].includes(slug);
}
export function offeringUrl(kind: string, slug: string) {
  if (kind === "package") return `/packages/${slug}`;
  if (kind === "transformer") return `/transformers/${slug}`;
  if (kind === "show") return `/shows/${slug}`;
  if (kind === "extra") return `/extras/${slug}`;
  if (kind === "seasonal") return "/new-year";
  return "/characters";
}

export function serviceImage(slug: string) {
  const extensions: Record<string, string> = { animation: "png", nitrogen: "png", foam: "png", silver: "png", ribbons: "png", "cotton-candy-show": "png", projector: "png", photographer: "png", sound: "png", "new-year": "jpg" };
  return extensions[slug] ? `/media/services/${slug}.${extensions[slug]}` : undefined;
}

export const showImage = serviceImage;

export function packageImage(slug: string) {
  return ["sweet-vibe", "foam-party", "ice-breath", "full-party", "silver-party"].includes(slug)
    ? `/media/packages/${slug}.png`
    : undefined;
}
