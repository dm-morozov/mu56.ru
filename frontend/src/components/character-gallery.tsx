import { PhotoGallery } from "./photo-gallery";
import { archivePhotoDescription } from "@/lib/archive-photo-descriptions";
import type { CharacterPhoto } from "@/lib/types";

// This square portrait loses the performer's face in the centered 3:2 preview.
// Match the file, not its order: reordering the gallery must not crop another photo.
// Local and production uploads have different names but identical SHA-256 bytes.
const ladybugPortraits = [
  "/characters/ladybug/fb962cd8e3764f6aa3f70a93f307763c.webp",
  "/characters/ladybug/17a16e47cd9b46eb83fb2b7f6edf291c.webp",
];

export function CharacterGallery({ photos, name }: { photos?: CharacterPhoto[]; name: string }) {
  if (!photos?.length) return null;
  return <PhotoGallery photos={photos.map(photo => ({
    ...photo,
    alt: archivePhotoDescription(photo.url, photo.alt),
    thumbnailPosition: photo.thumbnailPosition ?? (ladybugPortraits.some(path => photo.url.split("?")[0].endsWith(path)) ? "center top" : undefined),
  }))} title={`${name} на праздниках`} description="Фотографии из нашего архива. Костюм и детали программы согласуем для вашего праздника." />;
}
