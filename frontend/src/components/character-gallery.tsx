import Image from "next/image";
import type { CharacterPhoto } from "@/lib/types";

export function CharacterGallery({ photos, name }: { photos?: CharacterPhoto[]; name: string }) {
  if (!photos?.length) return null;
  return <section className="container character-gallery"><div className="section-head"><div><span className="eyebrow">Такие встречи уже случались</span><h2>{name} на праздниках</h2></div><p>Фотографии из нашего архива. Костюм и детали программы согласуем для вашего праздника.</p></div><div className="character-gallery-grid">{photos.map((photo, index) => <a key={photo.url} href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть фотографию: ${name}, ${index + 1}`}><Image sizes="(max-width: 600px) 100vw, 600px" src={photo.url} alt={photo.alt} loading="lazy" width="700" height="500" /></a>)}</div></section>;
}
