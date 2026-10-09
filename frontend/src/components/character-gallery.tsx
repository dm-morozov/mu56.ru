import { PhotoGallery } from "./photo-gallery";
import { archivePhotoDescription } from "@/lib/archive-photo-descriptions";
import type { CharacterPhoto } from "@/lib/types";

export function CharacterGallery({ photos, name }: { photos?: CharacterPhoto[]; name: string }) {
  if (!photos?.length) return null;
  return <PhotoGallery photos={photos.map(photo => ({ ...photo, alt: archivePhotoDescription(photo.url, photo.alt) }))} title={`${name} на праздниках`} description="Фотографии из нашего архива. Костюм и детали программы согласуем для вашего праздника." />;
}
