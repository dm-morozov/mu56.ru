import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { basePrice, duration, rubles, type Offering } from "@/lib/types";
import { extraContent } from "@/lib/extras";
import { ChooseButton } from "./choose-button";

export function ExtraCard({ offering }: { offering: Offering }) {
  const content = extraContent[offering.slug];
  const price = basePrice(offering);
  const selection = ["photographer", "sound"].includes(offering.slug)
    ? { offering: "animation", addons: [offering.slug] }
    : { offering: offering.slug };
  const name = content?.title || offering.name;
  return <article className={`extra-card extra-card-${offering.slug}`} id={offering.slug}>
    <Link href={`/extras/${offering.slug}`} className="extra-card-photo" aria-label={`Подробнее: ${name}`}>
      {content && <Image src={content.image} alt={offering.slug === "pinata" ? "Бирюзовая сова-пиньята" : name} width={640} height={430} sizes="(max-width:700px) 100vw, (max-width:1100px) 50vw, 400px" />}
      <span className="extra-card-tag">{content?.tag || "Дополните праздник"}</span>
    </Link>
    <div className="extra-card-copy"><h3>{name}</h3><p>{content?.description || offering.description}</p><p className="extra-card-note">{content?.note || offering.requirements}</p>
      <div className="extra-card-price"><strong>{price === undefined ? "Стоимость согласуем" : `+ ${rubles(price)}`}</strong><span>{price === undefined ? "Под вашу компанию и пожелания" : offering.duration_minutes ? `за ${duration(offering.duration_minutes)}` : "к стоимости программы"}</span></div>
      <ChooseButton {...selection} className="button outline">{content?.action || "Обсудить дополнение"}</ChooseButton>
      <Link href={`/extras/${offering.slug}`} className="text-link extra-details">Подробнее <ArrowUpRight size={15} /></Link>
    </div>
  </article>;
}
