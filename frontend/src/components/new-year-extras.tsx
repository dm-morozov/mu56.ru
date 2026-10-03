import Link from "next/link";
import type { Offering } from "@/lib/types";
import { duration } from "@/lib/types";

const descriptions: Record<string, string> = {
  nitrogen: "Добавьте к новогодней сказке азотное шоу с мороженым — ещё один яркий этап праздника.",
  silver: "Серебряное, или фольгированное, шоу: продолжение праздника с музыкой и блестящими впечатлениями.",
  "cotton-candy-show": "Сладкая вата как шоу и мастер-класс: дети делают свою вату с помощью ведущего.",
};

export function NewYearExtras({ offerings }: { offerings: Offering[] }) {
  const shows = offerings.filter(item => item.slug in descriptions);
  return <section className="container section new-year-extras">
    <div className="section-head"><div><span className="eyebrow">Пусть сказка продолжается</span><h2>Добавьте шоу к празднику</h2></div><p>После поздравления можно продолжить праздник. Дед Мороз и Снегурочка остаются вдвоём — продолжительность шоу добавляется к выбранной программе.</p></div>
    <div className="new-year-extra-grid">{shows.map(show => <article key={show.slug}><span className="small-badge">{duration(show.duration_minutes)}</span><h3>{show.name}</h3><p>{descriptions[show.slug]}</p><Link className="text-link" href={`/shows/${show.slug}`}>Посмотреть программу шоу</Link></article>)}</div>
    <p className="muted">Отметьте нужные шоу в заявке. Стоимость продолжения праздника с двумя героями согласуем отдельно.</p>
  </section>;
}
