import Image from "next/image";
import hero750 from "../../public/media/bumblebee-children-party-750.avif";
import hero1080 from "../../public/media/bumblebee-children-party-1080.avif";
import hero1437 from "../../public/media/bumblebee-children-party-1437.avif";

// Keep enough pixels for the tall object-fit:cover crop on narrow phones.
// Desktop sizes follow the hero's two columns and the 1240px container cap.
const sizes = "(max-width: 600px) 100vw, (max-width: 1100px) calc(50vw - 40px), (max-width: 1320px) calc(50vw - 66px), 594px";

export function HomeHeroImage() {
  return <picture>
    <source
      type="image/avif"
      sizes={sizes}
      srcSet={`${hero750.src} 750w, ${hero1080.src} 1080w, ${hero1437.src} 1437w`}
    />
    <Image
      sizes={sizes}
      src="/media/bumblebee-children-party.png"
      width={850}
      height={650}
      alt="Бамблби и увлечённые дети на настоящем празднике"
      loading="eager"
      fetchPriority="high"
    />
  </picture>;
}
