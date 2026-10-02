import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { getOccasion } from "@/lib/occasions";
import { pageMetadata } from "@/lib/seo";
import { getOfferings } from "@/lib/catalog";
import { basePrice, rubles } from "@/lib/types";
import { ChooseButton } from "@/components/choose-button";
import { OfferingCard, PackageCard } from "@/components/cards";

type Props = { params: Promise<{ occasion: string }> };
export async function generateMetadata({ params }: Props) {
  const { occasion } = await params, item = getOccasion(occasion);
  if (!item) notFound();
  return pageMetadata(`${item.title} в Оренбурге`, item.description, `/holidays/${item.slug}`);
}
export default async function OccasionPage({ params }: Props) {
  const { occasion } = await params, item = getOccasion(occasion);
  if (!item) notFound();
  const offerings = await getOfferings();
  const programs = item.programs.flatMap(slug => offerings.filter(program => program.slug === slug));
  const animation = offerings.find(program => program.kind === "animation");
  const sound = offerings.find(program => program.slug === "sound");
  const animationPrice = animation && basePrice(animation), soundPrice = sound && basePrice(sound);
  const example = animationPrice && soundPrice && animation?.duration_minutes === 60 ? animationPrice * 2 + soundPrice : undefined;
  return <main id="main">
    <section className="container occasion-hero"><div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><Link href="/holidays">Праздники для групп</Link></div><div className="occasion-hero-grid"><div><span className="eyebrow">{item.eyebrow}</span><h1>{item.title}<em>в Оренбурге</em></h1><p>{item.intro}</p><ul>{item.points.map(point => <li key={point}><Check size={19} />{point}</li>)}</ul><ChooseButton>Подобрать программу для группы</ChooseButton></div><figure><Image src={item.image} alt={item.imageAlt} width={850} height={650} sizes="(max-width: 800px) 100vw, 650px" fetchPriority="high" /><figcaption>Настоящие фотографии наших праздников</figcaption></figure></div></section>
    <section className="container section"><div className="section-head"><div><span className="eyebrow">Выбираем основу</span><h2>С чего начнётся <em>ваш праздник?</em></h2></div><p>Трансформер для яркого появления или готовый пакет с несколькими этапами.</p></div><p className="occasion-pricing-note">Ниже — цены за базовый состав программ. Для вашей группы отдельно согласуем число ведущих, звук и возможную доплату за выезд.</p><div className="occasion-program-grid">{programs.map(program => program.kind === "package" ? <PackageCard key={program.slug} offering={program} featured={program.slug === "full-party"} /> : <OfferingCard key={program.slug} offering={program} />)}</div><div className="occasion-links"><Link href="/packages" className="text-link">Все пакеты</Link><Link href="/transformers" className="text-link">Все трансформеры</Link><Link href="/extras" className="text-link">Дополнения к празднику</Link></div>
    {item.slug === "graduation" && example && <aside className="occasion-estimate"><div><span className="eyebrow">Пример расчёта</span><h3>1 час · два аниматора · комплект звука</h3><p>Два ведущих по {rubles(animationPrice!)} и колонка с двумя микрофонами за {rubles(soundPrice!)}. Шоу и возможный выезд оплачиваются отдельно. Это пример состава, а не фиксированная цена любого выпускного.</p></div><strong>{rubles(example)}</strong></aside>}</section>
    <section className="container occasion-planning"><div><span className="eyebrow">Соберём всё по делу</span><h2>Четыре детали.<br /><em>И уже есть план.</em></h2><p>В заявке можно сразу указать эти сведения. Если пока знаете не всё — поможем определиться.</p><ChooseButton className="button navy">Обсудить мой праздник</ChooseButton></div><ol>{item.planning.map((point, index) => <li key={point}><span>0{index + 1}</span>{point}</li>)}</ol></section>
    <section className="container section faq-section"><div><span className="eyebrow">До встречи с героями</span><h2>Что важно знать заранее</h2><div className="guarantee-card"><ShieldCheck size={27} /><h3>Гарантия хорошего праздника</h3><p>Оплата после праздника.<br />Не понравится — можете не платить.</p></div></div><div className="faq-list">{item.questions.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
  </main>;
}
