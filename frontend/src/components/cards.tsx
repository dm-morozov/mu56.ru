import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3, Mic2, Sparkles } from "lucide-react";
import { Character, Offering, basePrice, duration, rubles } from "@/lib/types";
import { characterImage, characterIsPhoto, offeringUrl, packageImage } from "@/lib/images";
import { ShowCard } from "./show-card";
import { ChooseButton } from "./choose-button";
import { packageTiming } from "@/lib/packages";
import { PackageContents } from "./package-contents";

export function CharacterCard({ character, index = 0 }: { character: Character; index?: number }) {
  const src = characterImage(character.slug);
  const bigHeroNames: Record<string, string> = { bumblebee: "Бамблби", "iron-man": "Железный человек", "optimus-prime": "Оптимус Прайм" };
  const name = bigHeroNames[character.slug] ? `${bigHeroNames[character.slug]} + второй герой на выбор` : character.name;
  const href = character.slug === "new-year-duo" ? "/new-year" : `/characters/${character.slug}`;
  return <article className={`character-card tone-${index % 5} ${characterIsPhoto(character.slug) ? "character-card-photo" : ""} ${character.slug === "new-year-duo" ? "character-card-new-year" : ""}`}>
    <Link href={href} className="character-visual" aria-label={`Посмотреть: ${name}`}>
      <span className="character-orbit" aria-hidden="true" />
      {src ? <Image sizes="(max-width: 600px) 50vw, (max-width: 900px) 50vw, 400px" src={src} alt={name} loading="lazy" width="400" height="520" /> : <div className="no-portrait"><Mic2 size={52} /><span>Программа с ведущим</span></div>}
      <span className="card-open"><ArrowUpRight size={20} /></span>
    </Link>
    <div className="character-info"><p>{character.category}</p><h3><Link href={href}>{name}</Link></h3>{character.availability === "check" && <span className="availability-note">Доступность уточняйте</span>}</div>
  </article>;
}

export function PackageCard({ offering, offerings, featured = false, aboveFold = false }: { offering: Offering; offerings: Offering[]; featured?: boolean; aboveFold?: boolean }) {
  const price = basePrice(offering);
  const timing = packageTiming(offering);
  const photo = packageImage(offering.slug);
  const timeBadge = <span className={photo ? "show-time package-time" : "small-badge"}><Clock3 size={14} /> {timing.approximate ? "≈ " : ""}{timing.active ? duration(timing.active) : "Время согласуем"} · игры и шоу</span>;
  return <article className={`package-card ${featured ? "featured" : ""}`}>
    {photo && <Link href={offeringUrl(offering.kind, offering.slug)} className="package-photo" aria-label={`Состав пакета «${offering.name}»`}><Image src={photo} alt={offering.name} width={600} height={400} sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 400px" loading={aboveFold ? "eager" : "lazy"} fetchPriority={aboveFold ? "high" : "auto"} />{timeBadge}{featured && <span className="package-star"><Sparkles size={21} /></span>}</Link>}
    <div className="package-card-copy">
    {!photo && <div className="package-top">{timeBadge}{featured && <span className="package-star"><Sparkles size={21} /></span>}</div>}
    <h3><Link href={offeringUrl(offering.kind, offering.slug)}>{offering.name}</Link></h3>
    <p className="package-description">{offering.description || "Любимый герой и шоу в одной программе"}</p>
    <PackageContents parts={offering.parts} offerings={offerings} />
    <div className="package-price">{price ? rubles(price) : "По запросу"}<span>за программу</span></div>
    <ChooseButton offering={offering.slug} className={`button ${featured ? "orange" : "outline"}`}>Выбрать пакет</ChooseButton>
    <Link href={offeringUrl(offering.kind, offering.slug)} className="text-link package-detail">Состав и условия <ArrowUpRight size={15} /></Link>
    </div>
  </article>;
}

export function OfferingCard({ offering }: { offering: Offering }) {
  if (offering.kind === "show") return <ShowCard offering={offering} />;
  const price = basePrice(offering), transformer = offering.kind === "transformer";
  const photo = transformer ? characterImage(offering.slug) : undefined;
  return <article className={`offering-card ${transformer ? "transformer-card" : ""}`}>
    {photo ? <Link href={offeringUrl(offering.kind, offering.slug)} className="offering-photo"><Image sizes="(max-width: 600px) 50vw, (max-width: 900px) 50vw, 400px" src={photo} alt={offering.name} loading="lazy" width="600" height="450" /></Link> : <span className="service-symbol"><Sparkles size={28} /></span>}
    <div className="offering-card-body"><span className="eyebrow">{transformer ? "Два героя в программе" : `${offering.duration_is_approximate ? "≈ " : ""}${duration(offering.duration_minutes)}`}</span><h3><Link href={offeringUrl(offering.kind, offering.slug)}>{offering.name}</Link></h3><p>{offering.description || "Формат подберём под площадку и гостей."}</p><div className="offering-card-bottom"><strong>{price ? rubles(price) : "Цену уточним"}</strong><Link className="round-link" href={offeringUrl(offering.kind, offering.slug)} aria-label={`Подробнее: ${offering.name}`}><ArrowUpRight size={22} /></Link></div></div>
  </article>;
}
