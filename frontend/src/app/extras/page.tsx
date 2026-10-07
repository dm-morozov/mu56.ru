import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Camera, Candy, Check, Sparkles } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ChooseButton } from "@/components/choose-button";
import { ExtraCard } from "@/components/extra-card";
import { getOfferings } from "@/lib/catalog";
import { extraOrder } from "@/lib/extras";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Дополнения к детскому празднику в Оренбурге", "Фотосъёмка, аквагрим, пиньята, сахарная вата с оператором и мощный звук для детского праздника в Оренбурге. Выберите дополнения и обсудите состав программы.", "/extras");
const questions = [
  ["Можно выбрать несколько дополнений?", "Да. Обсудим, как совместить их с основной программой и сколько времени понадобится. Фотосъёмку и звук можно выбрать в конструкторе; аквагрим, пиньяту и вату с оператором согласуем по числу гостей и условиям площадки."],
  ["Сахарная вата с оператором и шоу сладкой ваты — одно и то же?", "Это разные форматы. Оператор готовит угощение для гостей. В шоу сладкой ваты дети участвуют в музыкальных заданиях и готовят вату вместе с ведущим. Шоу можно выбрать в разделе «Услуги»."],
  ["Как понять, нужен ли мощный звук?", "Смотрим на число детей, размер площадки и выбранную программу. Для детского сада с компанией больше 30 детей рекомендуем мощный звук. В программах для выпускных и большой компании он уже учтён; в пенном пакете тоже включён в состав."],
  ["Почему у некоторых дополнений нет фиксированной цены?", "У аквагрима, пиньяты и ваты с оператором сначала согласуем объём работы и условия: число детей, продолжительность, рисунки или наполнение. Стоимость подтвердим до праздника. Возможный удалённый выезд рассчитываем по адресу."],
];

export default async function ExtrasPage() {
  const offerings = await getOfferings();
  const extras = offerings.filter(item => item.kind === "extra").sort((a, b) => {
    const aIndex = extraOrder.indexOf(a.slug), bIndex = extraOrder.indexOf(b.slug);
    return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
  });
  return <main id="main" className="extras-page">
    <div className="container extras-breadcrumb"><Breadcrumbs current={{ label: "Дополнения к празднику", href: "/extras" }} /></div>
    <section className="container extras-hero"><div className="extras-hero-copy"><span className="eyebrow">Дополнения к празднику · Оренбург</span><h1>Добавьте празднику<br /><em>свой характер.</em></h1><p>Улыбки — в кадр. Сладкую вату — в руки. Любимый образ — на щёки. Выберите детали, которые порадуют именно вашу компанию.</p><a href="#extra-catalog" className="button orange">Выбрать дополнения <ArrowUpRight size={19} /></a><span className="extras-hero-footnote">Добавим к анимации, трансформерам или готовому пакету — состав согласуем с вами.</span></div><div className="extras-hero-photo"><Image src="/media/services/cotton-candy-show.png" alt="Клоун со сладкой ватой на детском празднике" width={800} height={800} sizes="(max-width:700px) 100vw, 50vw" loading="eager" fetchPriority="high" /><span className="extras-photo-sticker"><Sparkles size={20} />Ещё одна<br />причина улыбнуться</span></div></section>
    <section className="container section" id="extra-catalog"><div className="section-head"><div><span className="eyebrow">Ваш праздник, ваши детали</span><h2>Что добавим <em>к впечатлениям?</em></h2></div><p>Выбирайте по настроению и пользе. Дополнения оплачиваются отдельно от основной программы.</p></div><div className="extras-grid">{extras.map(offering => <ExtraCard key={offering.slug} offering={offering} />)}<article className="extras-show-link"><span className="eyebrow">Хочется целое шоу?</span><Sparkles size={55} strokeWidth={1.2} /><h3>Одного «вау»<br />может быть мало.</h3><p>Азотное шоу с мороженым, серебряное, ленточное или музыкальная сладкая вата — выберите продолжение праздника.</p><Link href="/shows" className="button navy">Посмотреть шоу <ArrowUpRight size={19} /></Link><span>Состав, время и цены — в каталоге услуг.</span></article></div></section>
    <section className="container extras-help"><div><span className="eyebrow">Не нужно брать всё</span><h2>Подберём то,<br />что <em>подойдёт вам.</em></h2><p>Расскажите о детях и площадке. Поможем выбрать дополнения, которые хорошо сочетаются с вашей программой.</p><ChooseButton className="button navy">Помогите мне выбрать</ChooseButton></div><ul><li><Camera size={25} /><span><strong>Хотите быть в кадре вместе с детьми?</strong>Добавьте фотографа и побудьте гостем на своём празднике.</span></li><li><Candy size={25} /><span><strong>Планируете сладкое угощение?</strong>Обсудим вату с оператором или предложим интерактивное шоу.</span></li><li><Check size={25} /><span><strong>Компания большая?</strong>Уточним, нужен ли мощный звук и второй аниматор. Второго ведущего можно выбрать в форме пакета.</span></li></ul></section>
    <section className="container section faq-section"><div><span className="eyebrow">Уточним до праздника</span><h2>Всё понятно.<br /><em>Без сюрпризов в цене.</em></h2><p className="extras-faq-note">Согласуем программу, дополнения и условия выезда заранее. Оплата — после праздника.</p></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
  </main>;
}
