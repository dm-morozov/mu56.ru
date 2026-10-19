import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3, Users } from "lucide-react";
import { characterImage, offeringUrl, packageImage } from "@/lib/images";
import { type getOccasion } from "@/lib/occasions";
import { packagePrice, packageTiming } from "@/lib/packages";
import { basePrice, duration, rubles, type Offering } from "@/lib/types";
import { packageStageCondition } from "./package-stage-condition";
import styles from "./home-photo-cards.module.css";

export function HomePackageCard({ offering, offerings }: { offering: Offering; offerings: Offering[] }) {
  const href = offeringUrl(offering.kind, offering.slug);
  const photo = packageImage(offering.slug);
  const timing = packageTiming(offering);
  const price = packagePrice(offering, offerings);
  const soundIncluded = !packagePrice(offering, offerings, true).addonSound;
  const activeParts = offering.parts.filter(part => part.led_by_performer);
  const composition = activeParts.map(part => part.title.replace("Аниматор на праздник", "Анимация с героем"));
  const stageConditions = activeParts.flatMap(part => {
    const service = offerings.find(item => item.slug === part.service_slug);
    const condition = packageStageCondition(service);
    return condition ? [condition] : [];
  });
  const hasFoam = activeParts.some(part => part.service_slug === "foam");

  return <article className={styles.card} data-home-package={offering.slug}>
    {photo && <Link href={href} className={styles.photo} aria-label={`Посмотреть пакет «${offering.name}»`}>
      <Image src={photo} alt={offering.name} width={600} height={400} sizes="(max-width: 700px) 90vw, (max-width: 1320px) 46vw, 608px" loading="lazy" />
      <span className={styles.open} aria-hidden="true"><ArrowUpRight size={22} /></span>
    </Link>}
    <div className={styles.body}>
      <h3 className={styles.title}><Link href={href}>{offering.name}</Link></h3>
      {composition.length > 0 && <p className={styles.composition}>{composition.join(" + ")}</p>}
      <ul className={styles.facts} aria-label="Время с ведущим и команда">
        <li><Clock3 size={17} aria-hidden="true" /><span>{timing.approximate ? "≈ " : ""}{timing.active ? duration(timing.active) : "Время согласуем"} · игры и шоу</span></li>
        <li><Users size={17} aria-hidden="true" /><span>В команде: {offering.included_performers} чел.</span></li>
      </ul>
      {(soundIncluded || stageConditions.length > 0 || hasFoam || offering.requirements) && <div className={styles.conditions}>
        {soundIncluded && <p>Звук с двумя микрофонами включён.</p>}
        {stageConditions.map(condition => <p key={condition}>{condition}</p>)}
        {hasFoam && <p>Условия площадки и подходящую погоду обсудим при заказе.</p>}
        {offering.requirements && <p>{offering.requirements}</p>}
      </div>}
      <div className={styles.bottom}>
        <p className={styles.price}><strong>{price.total !== undefined ? rubles(price.total) : "Цену уточним"}</strong><span>за программу</span></p>
        <Link href={href} className={styles.primary} aria-label={`Состав и условия пакета «${offering.name}»`}>Состав и условия <ArrowUpRight size={19} aria-hidden="true" /></Link>
      </div>
    </div>
  </article>;
}

export function HomeTransformerCard({ offering }: { offering: Offering }) {
  const href = offeringUrl(offering.kind, offering.slug);
  const photo = characterImage(offering.slug);
  const price = basePrice(offering);

  return <article className={styles.card} data-home-transformer={offering.slug}>
    {photo && <Link href={href} className={`${styles.photo} ${styles.transformerPhoto}`} aria-label={`Посмотреть программу «${offering.name}»`}>
      <Image src={photo} alt={offering.name} width={600} height={450} sizes="(max-width: 700px) 90vw, (max-width: 1320px) 46vw, 608px" loading="lazy" />
      <span className={styles.open} aria-hidden="true"><ArrowUpRight size={22} /></span>
    </Link>}
    <div className={styles.body}>
      <h3 className={styles.title}><Link href={href}>{offering.name}</Link></h3>
      <p className={styles.composition}>{offering.included_performers === 2 ? "Два героя" : `В команде: ${offering.included_performers} чел.`} · {offering.duration_is_approximate ? "≈ " : ""}{duration(offering.duration_minutes)}</p>
      <div className={styles.bottom}>
        <p className={styles.price}><strong>{price !== undefined ? rubles(price) : "Цену уточним"}</strong><span>за программу</span></p>
        <Link href={href} className={styles.primary} aria-label={`Программа и фото: ${offering.name}`}>Программа и фото <ArrowUpRight size={19} aria-hidden="true" /></Link>
      </div>
    </div>
  </article>;
}

export function HomeOccasionCard({ occasion }: { occasion: NonNullable<ReturnType<typeof getOccasion>> }) {
  const href = `/holidays/${occasion.slug}`;

  return <article className={styles.card}>
    <Link href={href} className={styles.photo} aria-label={occasion.title}>
      <Image src={occasion.image} alt={occasion.imageAlt} width={600} height={450} sizes="(max-width: 700px) 90vw, (max-width: 1320px) 46vw, 608px" loading="lazy" />
      <span className={styles.open} aria-hidden="true"><ArrowUpRight size={22} /></span>
    </Link>
    <div className={styles.body}>
      <h3 className={styles.title}><Link href={href}>{occasion.shortTitle}</Link></h3>
      <p className={styles.composition}>{occasion.points[0]}</p>
      <Link href={href} className={styles.occasionLink} aria-label={`Посмотреть программы: ${occasion.title}`}>Посмотреть программы <ArrowUpRight size={19} aria-hidden="true" /></Link>
    </div>
  </article>;
}
