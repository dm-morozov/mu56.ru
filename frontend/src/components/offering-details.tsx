import Image from "next/image";
import { Clock3, ShieldCheck, Users } from "lucide-react";
import { Offering, basePrice, duration, rubles } from "@/lib/types";
import { characterImage } from "@/lib/images";
import { ChooseButton } from "./choose-button";
import { NewYearFormats } from "./new-year-formats";

export function OfferingDetails({ offering, allOfferings }: { offering: Offering; allOfferings: Offering[] }) {
  const price = basePrice(offering), transformer = offering.kind === "transformer", packaged = offering.kind === "package";
  const image = transformer ? characterImage(offering.slug) : offering.kind === "seasonal" ? characterImage("new-year-duo") : undefined;
  const addon = offering.prices.find(p => p.context === "with_animation");
  return <div className={`container detail-layout ${!image && !packaged ? "detail-layout-single" : ""}`}>
    {image ? <div className={`detail-photo photo-mode ${offering.kind === "seasonal" ? "new-year-photo" : ""}`}><Image sizes="(max-width: 900px) 100vw, 600px" src={image} alt={offering.name} width="600" height={offering.kind === "seasonal" ? 900 : 700} /></div> : packaged && <div className="detail-text-panel"><span className="eyebrow">Программа вашего праздника</span><h2>Уже собрали всё вместе</h2><ul className="detail-timeline">{offering.parts.map(part => <li key={part.position}><strong>{part.title}</strong><span>{part.is_approximate ? "≈ " : ""}{part.duration_minutes} мин</span></li>)}</ul><p className="muted">Фоновая музыка играет, пока команда собирает оборудование. На этом этапе никто не ведёт программу.</p></div>}
    <div className="detail-copy"><span className="eyebrow">{transformer ? "Два героя. Один большой праздник." : "Давайте выберем вашу программу"}</span><h2>{transformer ? "Большой герой + второй супергерой" : offering.name}</h2><p>{offering.description || "Подберём формат под вашу площадку и гостей."}</p>
      <div className="detail-badges">{offering.duration_minutes && <span className="small-badge"><Clock3 size={14} />{offering.duration_is_approximate ? "Около " : ""}{duration(offering.duration_minutes)}</span>}{(transformer || packaged) && <span className="small-badge"><Users size={14} />{offering.included_performers} {offering.included_performers === 1 ? "аниматор" : "участника команды"}</span>}</div>
      {price && offering.kind !== "seasonal" ? <div className="detail-price">{rubles(price)}<small>за программу</small></div> : offering.kind !== "seasonal" && <div className="detail-price">Цену уточним</div>}
      <div className="detail-tariffs">{addon && <div><span>Добавить к анимации</span><strong>+ {rubles(addon.amount_rub)}</strong></div>}{offering.prices.filter(p => p.context === "second_performer").map(p => <div key={p.code}><span>Добавить второго аниматора</span><strong>+ {rubles(p.amount_rub)}</strong></div>)}
      {transformer && allOfferings.filter(item => ["nitrogen", "silver", "cotton-candy-show"].includes(item.slug)).map(item => { const show = item.prices.find(p => p.context === "with_animation"), support = item.prices.find(p => p.context === "transformer_support"); return price && show && support ? <div key={item.slug}><span>Вместе с {item.slug === "nitrogen" ? "азотным шоу" : item.slug === "silver" ? "серебряным шоу" : "шоу сладкой ваты"}</span><strong>{rubles(price + show.amount_rub + support.amount_rub)}</strong></div> : null; })}</div>
      {offering.requirements && <p className="detail-requirements">{offering.requirements}</p>}
      {offering.kind === "seasonal" && <NewYearFormats offering={offering} />}
      <ChooseButton offering={offering.slug}>Обсудить эту программу</ChooseButton><p className="detail-terms"><ShieldCheck size={15} /> Оплата после праздника. Не понравится — можете не платить.<br />Удалённый выезд оплачивается отдельно, стоимость уточним по адресу.</p>
    </div>
  </div>;
}
