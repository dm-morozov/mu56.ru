import Image from "next/image";
import { Clock3, ShieldCheck, Users } from "lucide-react";
import { Offering, basePrice, duration, rubles } from "@/lib/types";
import { characterImage } from "@/lib/images";
import { ChooseButton } from "./choose-button";

const descriptions: Record<string, string> = {
  nitrogen: "Необычные опыты с жидким азотом и приготовление мороженого. Продолжительность — около 45 минут; число участников и требования к площадке согласуем заранее.",
  silver: "Серебряное, оно же фольгированное шоу: добавьте ещё один яркий этап к вашему празднику. Программа длится 30 минут.",
  ribbons: "Ленточное шоу на 30 минут. Площадку, порядок проведения и уборку обсудим при заказе.",
  "cotton-candy-show": "Дети участвуют в музыкальных заданиях, угадывают песни и под руководством ведущего сами готовят себе сладкую вату. Это интерактивное шоу, обычно на 30 минут.",
  projector: "Шоу с проектором на 30 минут. Состав игр, экран, свет и возможность проведения на вашей площадке заранее согласуем.",
  foam: "Пенная вечеринка длится около 40 минут. Большой звук включён. Условия площадки и подходящую погоду обсудим при заказе.",
  photographer: "Фотосъёмка праздника — 60 минут. Объём фотографий, сроки их передачи и доступность фотографа согласуем перед заказом.",
  sound: "JBL PartyBox 1000 и два профессиональных микрофона Shure. Время работы и размещение оборудования согласуем по формату мероприятия.",
  "face-painting": "Аквагрим с отдельным исполнителем может дополнять праздник. Стоимость, количество гостей и доступность уточним по дате.",
  pinata: "Пиньята — дополнение к празднику. Размер, наполнение, проведение игры и стоимость согласуем отдельно.",
  "cotton-candy-operator": "Оператор готовит сладкую вату для гостей во время мероприятия. Это отдельный формат, который может идти параллельно основной программе. Цена и количество порций согласуются отдельно.",
  "new-year": "Дед Мороз и Снегурочка приедут на вашу площадку. Можно выбрать поздравление на 15, 30, 45 или 60 минут. Для большой группы обсудим программу, звук и число гостей отдельно.",
};
export function OfferingDetails({ offering, allOfferings }: { offering: Offering; allOfferings: Offering[] }) {
  const price = basePrice(offering), transformer = offering.kind === "transformer", packaged = offering.kind === "package";
  const image = transformer ? characterImage(offering.slug) : offering.kind === "seasonal" ? characterImage("new-year-duo") : undefined;
  const hourTariff = offering.kind === "seasonal" ? offering.prices.find(p => p.duration_minutes === 60)?.amount_rub : undefined;
  const soundTariff = allOfferings.find(p => p.slug === "sound")?.prices.find(p => p.context === "base")?.amount_rub;
  const addon = offering.prices.find(p => p.context === "with_animation");
  return <div className="container detail-layout">
    {image ? <div className={`detail-photo ${transformer ? "photo-mode" : ""}`}><Image sizes="(max-width: 900px) 100vw, 600px" src={image} alt={offering.name} width="600" height="700" /></div> : <div className="detail-text-panel"><span className="eyebrow">Программа вашего праздника</span><h2>{packaged ? "Уже собрали всё вместе" : offering.name}</h2>{packaged ? <ul className="detail-timeline">{offering.parts.map(part => <li key={part.position}><strong>{part.title}</strong><span>{part.is_approximate ? "Около " : ""}{part.duration_minutes} мин</span></li>)}</ul> : <p>{descriptions[offering.slug] || offering.description}</p>}{packaged && <p className="muted">Фоновая музыка играет, пока команда собирает оборудование. На этом этапе никто не ведёт программу.</p>}</div>}
    <div className="detail-copy"><span className="eyebrow">{transformer ? "Два героя. Один большой праздник." : "Давайте выберем вашу программу"}</span><h2>{transformer ? "Большой герой + второй супергерой" : offering.name}</h2><p>{transformer ? "В программе два участника команды: большой герой и супергерой на выбор. Частый вариант — Бамблби и Человек-паук. Игры, знакомство и фотографии на вашей площадке." : packaged ? "Основная цена включает состав этого пакета. Героя выбираем из доступных персонажей, а программу согласуем по возрасту и компании детей." : descriptions[offering.slug] || offering.description || "Подберём формат под вашу площадку и гостей."}</p>
      <div className="detail-badges">{offering.duration_minutes && <span className="small-badge"><Clock3 size={14} />{offering.duration_is_approximate ? "Около " : ""}{duration(offering.duration_minutes)}</span>}{(transformer || packaged) && <span className="small-badge"><Users size={14} />{offering.included_performers} {offering.included_performers === 1 ? "аниматор" : "участника команды"}</span>}</div>
      {price && offering.kind !== "seasonal" ? <div className="detail-price">{rubles(price)}<small>за программу</small></div> : offering.kind !== "seasonal" && <div className="detail-price">Цену уточним</div>}
      <div className="detail-tariffs">{addon && <div><span>При заказе с анимацией</span><strong>{rubles(addon.amount_rub)}</strong></div>}{offering.prices.filter(p => p.context === "second_performer").map(p => <div key={p.code}><span>Добавить второго аниматора</span><strong>+ {rubles(p.amount_rub)}</strong></div>)}{offering.kind === "seasonal" && offering.prices.map(p => <div key={p.code}><span>{p.duration_minutes} минут · два героя</span><strong>{rubles(p.amount_rub)}</strong></div>)}
      {transformer && allOfferings.filter(item => ["nitrogen", "silver", "cotton-candy-show"].includes(item.slug)).map(item => { const show = item.prices.find(p => p.context === "with_animation"), support = item.prices.find(p => p.context === "transformer_support"); return price && show && support ? <div key={item.slug}><span>Вместе с {item.slug === "nitrogen" ? "азотным шоу" : item.slug === "silver" ? "серебряным шоу" : "шоу сладкой ваты"}</span><strong>{rubles(price + show.amount_rub + support.amount_rub)}</strong></div> : null; })}</div>
      {transformer && <p>Для проведения дома нужны потолки от 2,30 м. Размер дверей не критичен. Проходы, свободное пространство и состав спецэффектов согласуем заранее.</p>}
      {offering.kind === "seasonal" && <><p>Дед Мороз и Снегурочка всегда проводят эту программу вместе. Выберите продолжительность поздравления — оба героя включены в каждый тариф.</p>{hourTariff && soundTariff && <div className="detail-tariffs"><div><span>Для большого мероприятия: 1 час + комплект звука</span><strong>{rubles(hourTariff + soundTariff)}</strong></div></div>}<p className="muted">JBL PartyBox 1000 и два микрофона Shure — отдельное дополнение. Необходимость звука обсудим по размеру группы и площадке.</p></>}
      <ChooseButton offering={offering.slug}>Обсудить эту программу</ChooseButton><p className="detail-terms"><ShieldCheck size={15} /> Оплата после праздника. Не понравится — можете не платить.<br />Удалённый выезд оплачивается отдельно, стоимость уточним по адресу.</p>
    </div>
  </div>;
}
