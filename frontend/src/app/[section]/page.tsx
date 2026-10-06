import { notFound } from "next/navigation";
import { getOfferings } from "@/lib/catalog";
import { OfferingCard, PackageCard } from "@/components/cards";
import { ServiceCard } from "@/components/service-card";
import { PageIntro } from "@/components/page-intro";
import { PackageComparison } from "@/components/package-comparison";
import Link from "next/link";

import { sortPackages } from "@/lib/packages";
import { pageMetadata } from "@/lib/seo";
const sections: Record<string, { kind: string; title: string; description: string; eyebrow: string }> = {
  transformers: { kind: "transformer", title: "Герои супергеройского масштаба", eyebrow: "Большие герои — большие впечатления", description: "Бамблби, Оптимус или Железный человек вместе со вторым супергероем на выбор. Час игр, общения и фотографий на вашей площадке." },
  packages: { kind: "package", title: "Готовые программы детского праздника", eyebrow: "Праздник уже собран", description: "Анимация с любимым героем, шоу и музыка после программы. Сравните состав и время — и выберите праздник для своей компании." },
  shows: { kind: "show", title: "Добавим ещё одно «вау!»", eyebrow: "Услуги для детских праздников", description: "Анимация, шоу, новогодние поздравления, фотосъёмка и звук в Оренбурге. Выберите любимого героя и добавьте впечатлений — состав и цену покажем в конструкторе." },
  extras: { kind: "extra", title: "Маленькие детали большого праздника", eyebrow: "Дополнения к празднику", description: "Фотограф, аквагрим, пиньята, сахарная вата с оператором и дополнительный звук. Некоторые услуги могут идти параллельно основной программе." },
};
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; const info = sections[section]; if (!info) return {title: "Страница не найдена"}; const title = ({transformers:"Трансформеры на детский праздник",packages:"Пакеты детских праздников",shows:"Услуги для детских праздников",extras:"Дополнения к празднику"} as Record<string,string>)[section]; return pageMetadata(title, info.description, `/${section}`); }
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params, info = sections[section]; if (!info) notFound();
  const allOfferings = await getOfferings();
  const items = allOfferings.filter(item => section === "shows" ? item.service_position != null : item.kind === info.kind);
  if (section === "shows") items.sort((a, b) => a.service_position! - b.service_position! || a.slug.localeCompare(b.slug));
  const transformers = allOfferings.filter(item => item.kind === "transformer");
  // Several transformer programs share one entry point in the services catalog.
  const firstTransformer = items.find(item => item.kind === "transformer");
  const catalogItems = section === "shows" ? items.filter(item => item.kind !== "transformer" || item === firstTransformer) : items;
  const offerings = info.kind === "package" ? sortPackages(catalogItems) : catalogItems;
  return <main id="main"><PageIntro path={`/${section}`} breadcrumbLabel={({ transformers: "Трансформеры", packages: "Пакеты", shows: "Услуги", extras: "Дополнения к празднику" } as Record<string, string>)[section]} {...info} /><section className="container inner-content">{info.kind === "package" && <div className="comparison-jump"><p>Что входит в цену и сколько времени дети проведут с ведущим?</p><Link href="#compare" className="button navy">Сравнить пакеты</Link></div>}{info.kind === "show" && <div className="show-catalog-note"><strong>Соберите праздник вокруг любимого героя</strong><p>Выберите анимацию или добавьте к ней шоу, фотосъёмку и звук. Выбранная услуга уже будет отмечена в конструкторе — её можно убрать или дополнить другими. Итоговую стоимость покажем в форме.</p></div>}<div className={info.kind === "package" ? "package-grid inner-packages" : "offering-grid"}>{offerings.map(item => info.kind === "package" ? <PackageCard offerings={allOfferings} key={item.slug} offering={item} featured={item.slug === "full-party"} /> : section === "shows" && item.kind !== "show" ? <ServiceCard key={item.slug} offering={item} transformers={transformers} /> : <OfferingCard key={item.slug} offering={item} />)}</div>{info.kind === "package" && <PackageComparison packages={offerings} />}</section></main>;
}
