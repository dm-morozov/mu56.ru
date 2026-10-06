import Image from "next/image";
import { Clock3, ShieldCheck, Users } from "lucide-react";
import { Offering, basePrice, duration, rubles } from "@/lib/types";
import { characterImage, serviceImage, packageImage } from "@/lib/images";
import { ChooseButton } from "./choose-button";
import { ProgramExtras } from "./program-extras";
import { NewYearFormats } from "./new-year-formats";

export function OfferingDetails({ offering, allOfferings }: { offering: Offering; allOfferings: Offering[] }) {
  const price = basePrice(offering), transformer = offering.kind === "transformer", packaged = offering.kind === "package";
  const image = packaged ? packageImage(offering.slug) : transformer ? characterImage(offering.slug) : offering.kind === "seasonal" ? characterImage("new-year-duo") : serviceImage(offering.slug);
  const addon = offering.prices.find(p => p.context === "with_animation");
  const addonOnly = ["sound", "photographer"].includes(offering.slug);
  if (offering.kind === "seasonal") return <div className="container new-year-offer">
    <div className="new-year-intro"><div className="detail-photo photo-mode new-year-photo"><Image loading="eager" fetchPriority="high" src={image!} alt="Дед Мороз и Снегурочка в наших новых костюмах" width={1024} height={1536} sizes="(max-width: 600px) 100vw, 500px" /></div><div><span className="eyebrow">Два героя. Настоящая встреча.</span><h2>От поздравления у ёлки<br />до <em>целого приключения.</em></h2><p>Выберите короткую встречу, поздравление с играми или путешествие в Великий Устюг за подарками. Дед Мороз и Снегурочка проводят программу вместе.</p><p>Дома, в детском саду, школе или во дворе — подберём формат под вашу компанию и площадку.</p><a className="button orange" href="#new-year-formats">Выбрать свою сказку ↓</a><p className="detail-terms">Оплата после праздника. Не понравится — можете не платить.<br />Удалённый выезд согласуем отдельно.</p></div></div>
    <NewYearFormats offering={offering} />
  </div>;
  return <div className={`container detail-layout ${!image && !packaged ? "detail-layout-single" : ""}`}>
    {packaged ? <div className="detail-text-panel">{image && <div className="package-detail-photo"><Image src={image} alt={offering.name} width={600} height={400} sizes="(max-width: 900px) 100vw, 600px" /></div>}<span className="eyebrow">Программа вашего праздника</span><h2>Уже собрали всё вместе</h2><ul className="detail-timeline">{offering.parts.map(part => <li key={part.position}><strong>{part.title}</strong><span>{part.is_approximate ? "≈ " : ""}{part.duration_minutes} мин</span></li>)}</ul><p className="muted">Фоновая музыка играет, пока команда собирает оборудование. На этом этапе никто не ведёт программу.</p></div> : image ? <div className={`detail-photo photo-mode ${!transformer ? "service-detail-photo" : ""}`}><Image sizes="(max-width: 900px) 100vw, 600px" src={image} alt={offering.name} width="600" height={transformer ? 700 : 400} /></div> : null}
    <div className="detail-copy"><span className="eyebrow">{transformer ? "Два героя. Один большой праздник." : "Давайте выберем вашу программу"}</span><h2>{transformer ? "Большой герой + второй герой на выбор" : offering.name}</h2><p>{offering.description || "Подберём формат под вашу площадку и гостей."}</p>
      <div className="detail-badges">{offering.duration_minutes && <span className="small-badge"><Clock3 size={14} />{offering.duration_is_approximate ? "Около " : ""}{duration(offering.duration_minutes)}</span>}{(transformer || packaged) && <span className="small-badge"><Users size={14} />{offering.included_performers} {offering.included_performers === 1 ? "аниматор" : "участника команды"}</span>}</div>
      {price && offering.kind !== "seasonal" ? <div className="detail-price">{rubles(price)}<small>за программу</small></div> : offering.kind !== "seasonal" && <div className="detail-price">Цену уточним</div>}
      {transformer && <ChooseButton offering={offering.slug}>Хочу эту программу</ChooseButton>}
      <div className="detail-tariffs">{addon && <div><span>Добавить к анимации</span><strong>+ {rubles(addon.amount_rub)}</strong></div>}{offering.prices.filter(p => p.context === "second_performer").map(p => <div key={p.code}><span>Добавить второго аниматора</span><strong>+ {rubles(p.amount_rub)}</strong></div>)}
      </div>
      {offering.requirements && <p className="detail-requirements">{offering.requirements}</p>}
      {offering.kind === "seasonal" && <NewYearFormats offering={offering} />}
      {offering.kind === "show" && <><ChooseButton offering="animation" addons={[offering.slug]}>Добавить к анимации</ChooseButton><p className="muted">Шоу продлевает программу. Анимация оплачивается отдельно — состав и итог покажем в заявке.</p></>}
      {addonOnly && <p className="muted">Доступно только вместе с нашей программой праздника.</p>}
      {!transformer && <ChooseButton offering={addonOnly ? "animation" : offering.slug} addons={addonOnly ? [offering.slug] : undefined} className={offering.kind === "show" ? "button outline" : "button orange"}>{addonOnly ? "Добавить к программе" : offering.kind === "show" ? "Заказать только шоу" : "Хочу эту программу"}</ChooseButton>}<p className="detail-terms"><ShieldCheck size={15} /> Оплата после праздника. Не понравится — можете не платить.<br />Удалённый выезд оплачивается отдельно, стоимость уточним по адресу.</p>
    </div>
      {transformer && <section className="transformer-extras" aria-labelledby="transformer-extras-title"><div className="section-head"><div><span className="eyebrow">Праздник с продолжением</span><h2 id="transformer-extras-title">Добавьте празднику <em>впечатлений</em></h2></div><p>После встречи с героями оба аниматора переоденутся и проведут шоу. Выберите добавку — продолжим в конструкторе.</p></div><ProgramExtras offering={offering} offerings={allOfferings} /></section>}
  </div>;
}
