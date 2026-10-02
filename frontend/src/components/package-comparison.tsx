import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Offering, basePrice, duration, rubles } from "@/lib/types";
import { ChooseButton } from "./choose-button";

const suggestions: Record<string, string> = {
  "sweet-vibe": "Когда хочется героя и сладкого мастер-класса",
  "silver-party": "Когда хочется игр и серебряного шоу",
  "ice-breath": "Когда ребёнку интересны необычные опыты",
  "full-party": "Когда хочется совместить опыты и сладкую вату",
  "foam-party": "Когда хочется большой программы с пеной — площадку согласуем заранее",
};

export function PackageComparison({ packages }: { packages: Offering[] }) {
  if (!packages.length) return null;
  const summaries = packages.map(item => ({
    item, price: basePrice(item),
    active: item.parts.filter(part => part.led_by_performer).reduce((sum, part) => sum + part.duration_minutes, 0),
    background: item.parts.filter(part => !part.led_by_performer).reduce((sum, part) => sum + part.duration_minutes, 0),
    approximate: item.parts.some(part => part.led_by_performer && part.is_approximate),
    extra: item.prices.find(price => price.context === "second_performer"),
  }));
  const showRows = [...new Map(packages.flatMap(item => item.parts.filter(part => part.led_by_performer && part.service_slug && part.service_slug !== "animation")).map(part => [part.service_slug, part.title])).entries()];
  return <section className="package-comparison" id="compare" aria-labelledby="compare-title">
    <div className="section-head"><div><span className="eyebrow">Разница — перед глазами</span><h2 id="compare-title">Какой пакет <em>вам подходит?</em></h2></div><p>Сравните впечатления и время с ведущим. Все цены — за базовый состав из каталога.</p></div>
    <p className="comparison-scroll-hint"><ArrowDown size={16} aria-hidden="true" /> На небольшом экране таблицу можно листать вправо.</p>
    <div className="comparison-scroll" tabIndex={0} role="region" aria-label="Сравнение пакетов праздника. Таблица прокручивается по горизонтали">
      <table className="comparison-table"><caption className="comparison-caption">Состав, продолжительность и стоимость пакетов «Мира Улыбок»</caption><thead><tr><th scope="col">Что сравниваем</th>{summaries.map(({ item }) => <th scope="col" key={item.slug} className={item.slug === "full-party" ? "comparison-featured" : ""}><Link href={`/packages/${item.slug}`}>{item.name}<ArrowUpRight size={15} aria-hidden="true" /></Link></th>)}</tr></thead><tbody>
        <tr className="comparison-price"><th scope="row">Базовая цена</th>{summaries.map(({ item, price }) => <td key={item.slug}>{price ? rubles(price) : "Уточним"}</td>)}</tr>
        <tr><th scope="row">Игры и шоу с ведущим</th>{summaries.map(({ item, active, approximate }) => <td key={item.slug}>{active ? `${approximate ? "≈ " : ""}${duration(active)}` : "Уточним"}</td>)}</tr>
        <tr><th scope="row">Фоновая музыка после программы</th>{summaries.map(({ item, background }) => <td key={item.slug}>{background ? duration(background) : "Нет отдельного этапа"}</td>)}</tr>
        <tr><th scope="row">Анимация с героем</th>{summaries.map(({ item }) => { const part = item.parts.find(part => part.led_by_performer && part.service_slug === "animation"); return <td key={item.slug}>{part ? duration(part.duration_minutes) : "Не входит"}</td>; })}</tr>
        {showRows.map(([slug, title]) => <tr key={slug}><th scope="row">{title}</th>{summaries.map(({ item }) => { const part = item.parts.find(part => part.service_slug === slug && part.led_by_performer); return <td key={item.slug}>{part ? `${part.is_approximate ? "≈ " : ""}${duration(part.duration_minutes)}` : <span className="comparison-absent">Не входит</span>}</td>; })}</tr>)}
        <tr><th scope="row">Участников команды в базовом составе</th>{summaries.map(({ item }) => <td key={item.slug}>{item.included_performers}</td>)}</tr>
        <tr><th scope="row">Добавить второго аниматора</th>{summaries.map(({ item, extra }) => <td key={item.slug}>{extra ? `+ ${rubles(extra.amount_rub)}` : "Обсудим состав"}</td>)}</tr>
        <tr className="comparison-idea"><th scope="row">Можно выбрать, если…</th>{summaries.map(({ item }) => <td key={item.slug}>{suggestions[item.slug] || "Вам нравится такой состав программы"}</td>)}</tr>
        <tr><th scope="row">Обсудить дату и состав</th>{summaries.map(({ item }) => <td key={item.slug}><ChooseButton offering={item.slug} className={`button ${item.slug === "full-party" ? "orange" : "outline"}`}>Выбрать</ChooseButton></td>)}</tr>
      </tbody></table>
    </div>
    <div className="comparison-notes"><p><strong>Фоновая музыка — без ведущего.</strong> Она играет, пока команда собирает оборудование. После игр и шоу аниматоры уже не проводят программу.</p><p>Для большой группы состав команды и звук подбираем отдельно. Удалённый выезд и нестандартные дополнения согласуем до заказа. Время опытов и пенной программы ориентировочное.</p></div>
  </section>;
}
