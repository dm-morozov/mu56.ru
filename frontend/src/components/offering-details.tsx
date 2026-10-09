import Image from "next/image";
import Link from "next/link";
import { Clock3, ShieldCheck, Users } from "lucide-react";
import { Offering, basePrice, duration, rubles } from "@/lib/types";
import { characterImage, serviceImage, packageImage } from "@/lib/images";
import { ChooseButton } from "./choose-button";
import { ProgramExtras } from "./program-extras";
import { NewYearFormats } from "./new-year-formats";
import { extraContent } from "@/lib/extras";
import { getOccasion } from "@/lib/occasions";
import { packagePrice } from "@/lib/packages";

export function OfferingDetails({ offering, allOfferings, occasion }: { offering: Offering; allOfferings: Offering[]; occasion?: NonNullable<ReturnType<typeof getOccasion>> }) {
  const transformer = offering.kind === "transformer", packaged = offering.kind === "package";
  const groupPrice = packagePrice(offering, allOfferings, occasion?.soundRequired);
  const price = packaged ? groupPrice.total : basePrice(offering);
  const returnHref = occasion ? `/holidays/${occasion.slug}#program-${offering.slug}` : undefined;
  const extra = offering.kind === "extra" ? extraContent[offering.slug] : undefined;
  const image = packaged ? packageImage(offering.slug) : transformer ? characterImage(offering.slug) : offering.kind === "seasonal" ? characterImage("new-year-duo") : extra?.image || serviceImage(offering.slug);
  const addon = offering.prices.find(p => p.context === "with_animation");
  const addonOnly = ["sound", "photographer"].includes(offering.slug);
  if (offering.kind === "seasonal") return <div className="container new-year-offer">
    <div className="new-year-intro"><div className="detail-photo photo-mode new-year-photo"><Image loading="eager" fetchPriority="high" src={image!} alt="Дед Мороз и Снегурочка в наших новых костюмах" width={1024} height={1536} sizes="(max-width: 600px) 100vw, 500px" /></div><div><span className="eyebrow">Два героя. Настоящая встреча.</span><h2>От поздравления у ёлки<br />до <em>целого приключения.</em></h2><p>Выберите короткую встречу, поздравление с играми или путешествие в Великий Устюг за подарками. Дед Мороз и Снегурочка проводят программу вместе.</p><p>Дома, в детском саду, школе или во дворе — подберём формат под вашу компанию и площадку.</p><a className="button orange" href="#new-year-formats">Выбрать свою сказку ↓</a><p className="detail-terms">Оплата после праздника. Не понравится — можете не платить.<br />Удалённый выезд согласуем отдельно.</p></div></div>
    <NewYearFormats offering={offering} />
  </div>;
  return <div className={`container detail-layout ${!image && !packaged ? "detail-layout-single" : ""}`}>
    {packaged ? <div className="detail-text-panel package-detail-panel">{image && <div className="package-detail-photo"><Image src={image} alt={offering.name} width={600} height={400} sizes="(max-width: 900px) 100vw, 600px" /></div>}<div className="package-detail-body"><span className="eyebrow">Программа вашего праздника</span><h2>Уже собрали всё вместе</h2><ul className="detail-timeline">{offering.parts.map(part => <li key={part.position}><strong>{part.title}</strong><span>{part.is_approximate ? "≈ " : ""}{part.duration_minutes} мин</span></li>)}</ul><p className="muted">Фоновая музыка играет, пока команда собирает оборудование. На этом этапе никто не ведёт программу.</p></div></div> : image ? <div className={`detail-photo photo-mode ${offering.slug === "pinata" ? "pinata-cover" : ""} service-detail-photo`}><Image sizes="(max-width: 900px) 100vw, 600px" src={image} alt={offering.name} width="600" height={transformer ? 700 : 400} /></div> : null}
    <div className="detail-copy"><span className="eyebrow">{transformer ? "Два героя. Один большой праздник." : "Давайте выберем вашу программу"}</span><h2>{transformer ? "Большой герой + второй герой на выбор" : offering.name}</h2><p>{extra?.description || offering.description || "Подберём формат под вашу площадку и гостей."}</p>
      {occasion && <div className="detail-requirements"><strong>{occasion.title}</strong><p>{occasion.soundRequired ? "Комплект мощного звука с двумя микрофонами включён в итоговую цену. В программе один аниматор; если детей больше 20, рекомендуем второго — он оплачивается отдельно." : "В цене один аниматор. Комплект мощного звука и второй аниматор добавляются по желанию. Если детей больше 20, рекомендуем второго аниматора; если больше 30 — комплект звука."}</p>{occasion.soundRequired && <p>Базовый пакет: {groupPrice.base !== undefined ? rubles(groupPrice.base) : "стоимость уточним"}. {groupPrice.addonSound ? `Комплект звука: ${groupPrice.soundPrice !== undefined ? rubles(groupPrice.soundPrice) : "стоимость уточним"}.` : "Звук уже включён в базовый пакет — повторной доплаты нет."}</p>}</div>}
      {extra && <><p className="detail-requirements">{extra.note}</p></>}<div className="detail-badges">{offering.duration_minutes && <span className="small-badge"><Clock3 size={14} />{offering.duration_is_approximate ? "Около " : ""}{duration(offering.duration_minutes)}</span>}{(transformer || packaged) && <span className="small-badge"><Users size={14} />{offering.included_performers} {offering.included_performers === 1 ? "аниматор" : "участника команды"}</span>}</div>
      {price && offering.kind !== "seasonal" ? <div className="detail-price">{rubles(price)}<small>{extra ? offering.duration_minutes ? `за ${duration(offering.duration_minutes)}` : "к стоимости программы" : occasion?.soundRequired ? "за программу со звуком" : "за программу"}</small></div> : offering.kind !== "seasonal" && <div className="detail-price">Цену уточним</div>}
      {transformer && <ChooseButton offering={offering.slug}>Хочу эту программу</ChooseButton>}
      <div className="detail-tariffs">{addon && <div><span>Добавить к анимации</span><strong>+ {rubles(addon.amount_rub)}</strong></div>}{offering.prices.filter(p => p.context === "second_performer").map(p => <div key={p.code}><span>Добавить второго аниматора</span><strong>+ {rubles(p.amount_rub)}</strong></div>)}
      </div>
      {offering.requirements && <p className="detail-requirements">{offering.requirements}</p>}
      {offering.kind === "seasonal" && <NewYearFormats offering={offering} />}
      {offering.kind === "show" && <><ChooseButton offering="animation" addons={[offering.slug]}>Добавить к анимации</ChooseButton><p className="muted">Шоу продлевает программу. Анимация оплачивается отдельно — состав и итог покажем в заявке.</p></>}
      {addonOnly && <p className="muted">Доступно только вместе с нашей программой праздника.</p>}
      {!transformer && !occasion && <ChooseButton offering={addonOnly ? "animation" : offering.slug} addons={addonOnly ? [offering.slug] : undefined} className={offering.kind === "show" ? "button outline" : "button orange"}>{extra?.action || (addonOnly ? "Добавить к программе" : offering.kind === "show" ? "Заказать только шоу" : "Хочу эту программу")}</ChooseButton>}{returnHref && <Link href={returnHref} className="button orange">Выбрать пакет для группы</Link>}<p className="detail-terms"><ShieldCheck size={15} /> Оплата после праздника. Не понравится — можете не платить.<br />Удалённый выезд оплачивается отдельно, стоимость уточним по адресу.</p>
    </div>
      {transformer && <section className="transformer-extras" aria-labelledby="transformer-extras-title"><div className="section-head"><div><span className="eyebrow">Праздник с продолжением</span><h2 id="transformer-extras-title">Добавьте празднику <em>впечатлений</em></h2></div><p>После встречи с героями оба аниматора переоденутся и проведут шоу. Выберите добавку — продолжим в конструкторе.</p></div><ProgramExtras offering={offering} offerings={allOfferings} /></section>}
  </div>;
}
