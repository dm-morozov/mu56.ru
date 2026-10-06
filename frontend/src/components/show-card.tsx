import Image from "next/image";
import Link from "next/link";
import { PartyPopper, Projector, Waves } from "lucide-react";
import type { Offering } from "@/lib/types";
import { basePrice, duration, rubles } from "@/lib/types";
import { showImage } from "@/lib/images";
import { ChooseButton } from "./choose-button";

export function ShowCard({ offering }: { offering: Offering }) {
  const price = basePrice(offering);
  const addon = offering.prices.find(p => p.context === "with_animation")?.amount_rub ?? price;
  const photo = showImage(offering.slug);
  const Icon = offering.slug === "projector" ? Projector : offering.slug === "foam" ? Waves : PartyPopper;
  return <article className="show-card">
    <Link href={`/shows/${offering.slug}`} className={`show-visual show-visual-${offering.slug}`} aria-label={`Подробнее: ${offering.name}`}>
      {photo ? <Image src={photo} alt={offering.name} width={640} height={430} sizes="(max-width:700px) 100vw, (max-width:1100px) 50vw, 400px" /> : <><span className="show-visual-orbit" /><Icon size={92} strokeWidth={1.3} aria-hidden="true" /><span className="show-visual-caption">Иллюстрация программы</span></>}
      <span className="show-time">{offering.duration_is_approximate ? "≈ " : ""}{duration(offering.duration_minutes)}</span>
    </Link>
    <div className="show-card-copy"><h3><Link href={`/shows/${offering.slug}`}>{offering.name}</Link></h3><p>{offering.description}</p>
      <div className="show-prices"><div><span>Шоу отдельно</span><strong>{price === undefined ? "Цену уточним" : rubles(price)}</strong></div><div className="show-addon-price"><span>Добавить к анимации</span><strong>{addon === undefined ? "Цену уточним" : `+ ${rubles(addon)}`}</strong></div></div>
      <p className="show-price-note">Анимация оплачивается отдельно. Шоу продлевает праздник.</p>
      <ChooseButton offering="animation" addons={[offering.slug]}>Добавить к анимации</ChooseButton>
      <div className="show-card-links"><ChooseButton offering={offering.slug} className="text-link">Заказать только шоу</ChooseButton><Link href={`/shows/${offering.slug}`} className="text-link">Подробнее</Link></div>
    </div>
  </article>;
}
