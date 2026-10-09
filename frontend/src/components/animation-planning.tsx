import Link from "next/link";
import { ChooseButton } from "./choose-button";
import "./animation-planning.css";

const venues = [
  { title: "Аниматор на дом", text: "Для игр понадобится свободное место. Перед праздником обсудим число детей, проходы и вещи, которые лучше убрать. Для большого костюма отдельно проверим высоту потолка и двери.", href: "/transformers", link: "Условия для больших героев" },
  { title: "В кафе или детской студии", text: "Вы выбираете и бронируете площадку, мы приезжаем с программой. Заранее согласуйте с площадкой время, место для игр и возможность выбранного шоу.", href: "/packages#compare", link: "Сравнить программы с шоу" },
  { title: "На улице или для большой группы", text: "Обсудим погоду, площадку, число детей, ведущих и звук. Стоимость дороги рассчитываем по адресу: универсальной доплаты за любой выезд нет.", href: "/holidays/large-events", link: "Праздники для групп" },
];

export function AnimationPlanning() {
  return <section className="container animation-planning" aria-labelledby="animation-planning-title">
    <div className="section-head"><div><span className="eyebrow">Выезд на вашу площадку</span><h2 id="animation-planning-title">Где будет <em>праздник?</em></h2></div><p>Игры и состав подбираем под вашу компанию. До заказа проверим, что программе подходит место, которое вы выбрали.</p></div>
    <div className="animation-venue-grid">{venues.map(venue => <article key={venue.title}><h3>{venue.title}</h3><p>{venue.text}</p><Link className="text-link" href={venue.href}>{venue.link} →</Link></article>)}</div>
    <div className="animation-booking"><div><h3>Как договориться о празднике</h3><ol><li><strong>Расскажите о вашей компании.</strong> Дата, время, адрес, возраст и примерное число детей. Героя можно выбрать вместе с нами.</li><li><strong>Согласуем программу и расчёт.</strong> Проверим свободную команду и костюм, уточним шоу, звук и стоимость дороги.</li><li><strong>Подтвердим договорённость.</strong> Заявка запускает обсуждение, а дату бронируем после согласования. Оплата — после праздника.</li></ol></div><ChooseButton offering="animation">Обсудить дату и площадку</ChooseButton></div>
  </section>;
}
