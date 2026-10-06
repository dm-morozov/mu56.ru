import Link from "next/link";
import Image from "next/image";
import { showImage } from "@/lib/images";
import { ChooseButton } from "./choose-button";
import type { Offering } from "@/lib/types";
import { duration, rubles, twoPerformerShowPrice } from "@/lib/types";

const descriptions: Record<string, string> = {
  nitrogen: "Добавьте к новогодней сказке азотное шоу с мороженым — ещё один яркий этап праздника.",
  silver: "Серебряное, или фольгированное, шоу: продолжение праздника с музыкой и блестящими впечатлениями.",
  "cotton-candy-show": "Сладкая вата как шоу и мастер-класс: дети делают свою вату с помощью ведущего.",
};

export function NewYearExtras({ offerings }: { offerings: Offering[] }) {
  const shows = offerings.filter(item => item.slug in descriptions);
  return <section className="container section new-year-extras">
    <div className="section-head"><div><span className="eyebrow">Пусть сказка продолжается</span><h2>Добавьте шоу к празднику</h2></div><p>После поздравления можно продолжить праздник. Оба аниматора переоденутся и проведут шоу вместе. Доплата включает их работу; время шоу продлевает дневную программу.</p></div>
    <div className="new-year-extra-grid">{shows.map(show => <article key={show.slug}><div className={`transformer-extra-photo show-visual-${show.slug}`}><Image src={showImage(show.slug)!} alt={show.name} width={640} height={430} sizes="(max-width:700px) 100vw, 33vw" /></div><div className="new-year-extra-copy"><span className="small-badge">{duration(show.duration_minutes)}</span><h3>{show.name}</h3><p>{descriptions[show.slug]}</p><p><strong>{twoPerformerShowPrice(show) === undefined ? "Цену уточним" : `+ ${rubles(twoPerformerShowPrice(show)!)}`}</strong> · 2 аниматора</p><ChooseButton offering="new-year" tariff="minutes-50" addons={[show.slug]} className="button outline">Добавить к сказке</ChooseButton><Link className="text-link" href={`/shows/${show.slug}`}>Посмотреть программу шоу</Link></div></article>)}</div>
    <p className="muted">Выберите одно или несколько шоу — итоговая цена появится в конструкторе. Для вечерних выездов 31 декабря и новогодней ночи продление шоу недоступно.</p>
  </section>;
}
