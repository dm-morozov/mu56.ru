import Image from "next/image";
import Link from "next/link";
import { Offering, basePrice, duration, rubles } from "@/lib/types";
import { characterImage, serviceImage } from "@/lib/images";
import { ChooseButton } from "./choose-button";

export function ServiceCard({ offering, transformers = [] }: { offering: Offering; transformers?: Offering[] }) {
  const seasonal = offering.kind === "seasonal";
  const transformer = offering.kind === "transformer";
  const addon = ["sound", "photographer"].includes(offering.slug);
  const href = seasonal ? "/new-year" : transformer ? "/transformers" : offering.kind === "animation" ? "/characters" : undefined;
  const photo = transformer ? characterImage(offering.slug) : serviceImage(offering.slug);
  const name = transformer ? "Трансформеры" : offering.slug === "photographer" ? "Фотосъёмка" : offering.name;
  const prices = transformer ? transformers.map(basePrice).filter((amount): amount is number => amount !== undefined) : seasonal ? offering.prices.map(item => item.amount_rub) : [];
  const price = transformer || seasonal ? prices.length ? Math.min(...prices) : undefined : basePrice(offering);
  const description = transformer ? "Бамблби, Оптимус Прайм или Железный человек приезжают со вторым героем на выбор. Час игр, общения и фотографий с двумя героями на вашей площадке. Подберём пару под интересы ребёнка." : offering.description;
  const selection = { offering: "animation", addons: addon ? [offering.slug] : undefined };
  const action = seasonal ? "Выбрать поздравление" : transformer ? "Выбрать большого героя" : offering.slug === "sound" ? "Добавить звук к анимации" : offering.slug === "photographer" ? "Добавить фотосъёмку" : "Выбрать персонажа";
  const image = photo && <Image src={photo} alt={name} width={640} height={430} sizes="(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw" />;
  return <article className={`show-card service-card service-card-${offering.slug}${href ? " service-card-browse" : ""}`}>
    {href ? <Link href={href} className="show-visual" aria-label={action}>{image}</Link> : <ChooseButton {...selection} className="show-visual service-visual">{image}<span className="sr-only">{action}</span></ChooseButton>}
    <div className="show-card-copy">
      <h3>{href ? <Link href={href}>{name}</Link> : <ChooseButton {...selection} className="service-title">{name}</ChooseButton>}</h3>
      <p>{description}</p>
      <div className="show-prices"><div><span>{seasonal ? "Поздравление двух героев" : transformer ? "1 час · два героя" : addon ? "Доплата к программе" : "1 час анимации"}</span><strong>{price === undefined ? "Цену уточним" : `${seasonal || transformer ? "от " : addon ? "+ " : ""}${rubles(price)}`}</strong></div></div>
      <p className="show-price-note">{seasonal ? "Выберите длительность и формат поздравления." : transformer ? "Оба героя входят в стоимость. Можно продолжить праздник шоу." : addon ? `Добавим к анимации или другой нашей программе.${offering.slug === "photographer" ? ` Цена за ${duration(offering.duration_minutes)}.` : ""} В форме дополнение можно убрать.` : "Игры по возрасту и любимый персонаж на вашей площадке."}</p>
      {href ? <Link href={href} className="button orange">{action} ↗</Link> : <ChooseButton {...selection}>{action}</ChooseButton>}
    </div>
  </article>;
}
