import { notFound } from "next/navigation";
import { getOfferings } from "@/lib/catalog";
import { OfferingCard, PackageCard } from "@/components/cards";
import { PageIntro } from "@/components/page-intro";
import { PackageComparison } from "@/components/package-comparison";
import Link from "next/link";

import { pageMetadata } from "@/lib/seo";
const sections: Record<string, { kind: string; title: string; description: string; eyebrow: string }> = {
  transformers: { kind: "transformer", title: "Герои супергеройского масштаба", eyebrow: "Большие герои — большие впечатления", description: "Бамблби, Оптимус или Железный человек вместе со вторым супергероем на выбор. Час игр, общения и фотографий на вашей площадке." },
  packages: { kind: "package", title: "Праздник уже собран", eyebrow: "Все пять пакетов", description: "Анимация с любимым героем, шоу и музыка после программы. Сравните состав и время — и выберите праздник для своей компании." },
  shows: { kind: "show", title: "Добавим ещё одно «вау!»", eyebrow: "Шоу для детских праздников", description: "Азотное, серебряное, ленточное шоу, сладкая вата и другие программы. Можно заказать отдельно или добавить к анимации." },
  extras: { kind: "extra", title: "Маленькие детали большого праздника", eyebrow: "Дополнения к празднику", description: "Фотограф, аквагрим, пиньята, сахарная вата с оператором и дополнительный звук. Некоторые услуги могут идти параллельно основной программе." },
};
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; const info = sections[section]; if (!info) return {title: "Страница не найдена"}; const title = ({transformers:"Трансформеры на детский праздник",packages:"Пакеты детских праздников",shows:"Шоу для детских праздников",extras:"Дополнения к празднику"} as Record<string,string>)[section]; return pageMetadata(title, info.description, `/${section}`); }
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params, info = sections[section]; if (!info) notFound();
  const offerings = (await getOfferings()).filter(item => item.kind === info.kind);
  return <main id="main"><PageIntro {...info} /><section className="container inner-content">{info.kind === "package" && <div className="comparison-jump"><p>Что входит в цену и сколько времени дети проведут с ведущим?</p><Link href="#compare" className="button navy">Сравнить пакеты</Link></div>}{info.kind === "show" && <div className="show-catalog-note"><strong>Герой + шоу = праздник с продолжением</strong><p>Сначала выберите шоу. По кнопке «Добавить к анимации» оно уже будет отмечено в заявке — останется выбрать героя. Итоговую стоимость покажем в форме.</p></div>}<div className={info.kind === "package" ? "package-grid inner-packages" : "offering-grid"}>{offerings.map(item => info.kind === "package" ? <PackageCard key={item.slug} offering={item} featured={item.slug === "full-party"} /> : <OfferingCard key={item.slug} offering={item} />)}</div>{info.kind === "package" && <PackageComparison packages={offerings} />}</section></main>;
}
