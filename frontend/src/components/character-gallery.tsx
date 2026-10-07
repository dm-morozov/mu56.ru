import { PhotoGallery } from "./photo-gallery";
import type { CharacterPhoto } from "@/lib/types";

export function CharacterGallery({ photos, name }: { photos?: CharacterPhoto[]; name: string }) {
  if (!photos?.length) return null;
  return <PhotoGallery photos={photos} title={`${name} на праздниках`} description="Фотографии из нашего архива. Костюм и детали программы согласуем для вашего праздника." />;
}
