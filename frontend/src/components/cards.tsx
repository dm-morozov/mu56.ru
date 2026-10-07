import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3, Mic2, Sparkles } from "lucide-react";
import { Character, Offering, basePrice, duration, rubles } from "@/lib/types";
import { characterImage, characterIsPhoto, offeringUrl, packageImage } from "@/lib/images";
import { ShowCard } from "./show-card";
import { ChooseButton } from "./choose-button";
import { packagePrice, packageTiming } from "@/lib/packages";
import { PackageContents } from "./package-contents";

export function CharacterCard({ character, index = 0, headingLevel = 3 }: { character: Character; index?: number; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const src = characterImage(character.slug);
  const host = character.slug === "graduation-host";
  const bigHeroNames: Record<string, string> = { bumblebee: "Бамблби", "iron-man": "Железный человек", "optimus-prime": "Оптимус Прайм" };
  const name = bigHeroNames[character.slug] ? `${bigHeroNames[character.slug]} + второй герой на выбор` : character.name;
  const href = character.slug === "new-year-duo" ? "/new-year" : bigHeroNames[character.slug] ? `/transformers/${character.slug}` : `/characters/${character.slug}`;
  return <article className={`character-card tone-${index % 5} ${characterIsPhoto(character.slug) ? "character-card-photo" : ""} ${character.slug === "new-year-duo" ? "character-card-new-year" : ""} ${host ? "character-card-host" : ""}`}>
    <Link href={href} className="character-visual" aria-label={`Посмотреть: ${name}`}>
      <span className="character-orbit" aria-hidden="true" />
      {src ? <Image sizes="(max-width: 600px) 50vw, (max-width: 900px) 50vw, 400px" src={src} alt={host ? "Дмитрий Морозов, основатель «Мира Улыбок»" : name} loading="lazy" width="400" height="520" /> : <div className="no-portrait"><Mic2 size={52} /><span>Программа с ведущим</span></div>}
      <span className="card-open"><ArrowUpRight size={20} /></span>
    </Link>
    <div className="character-info"><p>{character.category}</p><Heading className="character-card-title"><Link href={href}>{name}</Link></Heading>{host && <p className="character-team-note">На фото — основатель. Программу проводит команда.</p>}{character.availability === "check" && <span className="availability-note">Доступность уточняйте</span>}</div>
  </article>;
}

export function PackageCard({ offering, offerings, featured = false, aboveFold = false, includeSound = false, groupSoundOptional = false, occasion, headingLevel = 3 }: { offering: Offering; offerings: Offering[]; featured?: boolean; aboveFold?: boolean; includeSound?: boolean; groupSoundOptional?: boolean; occasion?: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const { addonSound, total: price } = packagePrice(offering, offerings, includeSound);
  const detailHref = `${offeringUrl(offering.kind, offering.slug)}${occasion ? `?occasion=${encodeURIComponent(occasion)}` : ""}`;
  const timing = packageTiming(offering);
  const photo = packageImage(offering.slug);
  const timeBadge = <span className={photo ? "show-time package-time" : "small-badge"}><Clock3 size={14} /> {timing.approximate ? "≈ " : ""}{timing.active ? duration(timing.active) : "Время согласуем"} · игры и шоу</span>;
  return <article id={occasion ? `program-${offering.slug}` : undefined} className={`package-card ${featured ? "featured" : ""}`}>
    {photo && <Link href={detailHref} className="package-photo"><Image src={photo} alt={offering.name} width={600} height={400} sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 400px" loading={aboveFold ? "eager" : "lazy"} fetchPriority={aboveFold ? "high" : "auto"} />{timeBadge}{featured && <span className="package-star"><Sparkles size={21} /></span>}</Link>}
    <div className="package-card-copy">
    {!photo && <div className="package-top">{timeBadge}{featured && <span className="package-star"><Sparkles size={21} /></span>}</div>}
    <Heading className="package-card-title"><Link href={detailHref}>{offering.name}</Link></Heading>
    <p className="package-description">{offering.description || "Любимый герой и шоу в одной программе"}</p>
    <PackageContents parts={offering.parts} offerings={offerings} />
    {includeSound && <p className="package-group-note"><strong>Комплект мощного звука с двумя микрофонами — в цене.</strong><br />Героя анимации выберите в форме. Если детей больше 20, рекомендуем добавить второго аниматора — он оплачивается отдельно.{featured && <span className="package-group-highlight">Насыщенная программа с двумя шоу</span>}</p>}
    {groupSoundOptional && <p className="package-group-note"><strong>Цена за программу с одним аниматором, без комплекта мощного звука с микрофонами.</strong><br />Если детей больше 20, рекомендуем второго аниматора. Если больше 30 — комплект мощного звука с двумя микрофонами. Оба дополнения можно выбрать в форме.{featured && <span className="package-group-highlight">Насыщенная программа с двумя шоу</span>}</p>}
    <div className="package-price">{price ? rubles(price) : "По запросу"}<span>{includeSound ? "за программу со звуком" : "за программу"}</span></div>
    <ChooseButton offering={offering.slug} addons={addonSound ? ["sound"] : undefined} className={`button ${featured ? "orange" : "outline"}`}>Выбрать пакет</ChooseButton>
    <Link href={detailHref} className="text-link package-detail" aria-label={`Состав и условия: ${offering.name}`}>Состав и условия <ArrowUpRight size={15} /></Link>
    </div>
  </article>;
}

export function OfferingCard({ offering, includeSound = false, soundPrice, groupSoundOptional = false }: { offering: Offering; includeSound?: boolean; soundPrice?: number; groupSoundOptional?: boolean }) {
  if (offering.kind === "show") return <ShowCard offering={offering} />;
  const base = basePrice(offering), transformer = offering.kind === "transformer";
  const price = includeSound ? (base !== undefined && soundPrice !== undefined ? base + soundPrice : undefined) : base;
  const photo = transformer ? characterImage(offering.slug) : undefined;
  const groupCard = includeSound || groupSoundOptional;
  return <article className={`offering-card ${transformer ? "transformer-card" : ""} ${groupCard ? "group-offering-card" : ""}`}>
    {photo ? <Link href={offeringUrl(offering.kind, offering.slug)} className="offering-photo"><Image sizes="(max-width: 600px) 50vw, (max-width: 900px) 50vw, 400px" src={photo} alt={offering.name} loading="lazy" width="600" height="450" /></Link> : <span className="service-symbol"><Sparkles size={28} /></span>}
    <div className="offering-card-body"><span className="eyebrow">{transformer ? "Два героя в программе" : `${offering.duration_is_approximate ? "≈ " : ""}${duration(offering.duration_minutes)}`}</span><h3><Link href={offeringUrl(offering.kind, offering.slug)}>{offering.name}</Link></h3><p>{offering.description || "Формат подберём под площадку и гостей."}</p>{groupCard && <p className="offering-group-sound">{includeSound ? "Комплект мощного звука с двумя микрофонами — в цене." : "Два героя уже входят в цену. Комплект мощного звука с двумя микрофонами оплачивается отдельно — рекомендуем добавить его, если детей больше 30."}</p>}<div className="offering-card-bottom"><strong>{price ? rubles(price) : "Цену уточним"}{includeSound && <small>за программу со звуком</small>}</strong>{!groupCard && <Link className="round-link" href={offeringUrl(offering.kind, offering.slug)} aria-label={`Подробнее: ${offering.name}`}><ArrowUpRight size={22} /></Link>}</div>{groupCard && <><ChooseButton offering={offering.slug} addons={includeSound ? ["sound"] : undefined} className="button outline">Выбрать программу</ChooseButton><Link href={offeringUrl(offering.kind, offering.slug)} className="text-link package-detail" aria-label={`Состав и условия: ${offering.name}`}>Состав и условия <ArrowUpRight size={15} /></Link></>}</div>
  </article>;
}
