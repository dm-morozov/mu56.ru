import Image from "next/image";
import { HomeHeroImage } from "@/components/home-hero-image";
import { PhotoCarousel } from "@/components/photo-carousel";
import { HomePackageCard, HomeOccasionCard, HomeTransformerCard } from "@/components/home-photo-cards";
import { occasions } from "@/lib/occasions";
import { sortPackages } from "@/lib/packages";
import "./home.css";
import { MessengerLinks } from "@/components/messenger-links";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Heart, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { getCharacters, getOfferings } from "@/lib/catalog";
import { CharacterCard } from "@/components/cards";
import { SeasonalOffer } from "@/components/seasonal-offer";
import { ChooseButton } from "@/components/choose-button";
import { basePrice, duration, rubles } from "@/lib/types";
import { absoluteUrl, siteOpenGraph, website } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";

import { getReviews } from "@/lib/editorial";
import { ReviewCards } from "@/components/editorial-cards";

export const metadata = { alternates: { canonical: "/" }, openGraph: { ...siteOpenGraph, url: absoluteUrl("/") } };

export default async function Home() {
  const [offerings, characters, reviews] = await Promise.all([getOfferings(), getCharacters(), getReviews()]);
  const animation = offerings.find(item => item.kind === "animation");
  const bumblebee = offerings.find(item => item.slug === "bumblebee");
  const featuredPackages = sortPackages(offerings.filter(item => item.kind === "package"));
  const featuredCharacters = ["spider-man", "tiktok", "captain-america", "chase"].flatMap(slug => characters.filter(item => item.slug === slug));
  return <main id="main" className="home-page">
    <StructuredData data={website} />
    <section className="hero container">
      <div className="hero-copy"><span className="eyebrow"><span className="tiny-star">✳</span> Аниматоры и шоу в Оренбурге</span><h1>Праздник,<br />который дети<br /><span>не забудут.</span></h1><p>Любимые герои, настоящие трансформеры<br className="desktop-break" /> и шоу, от которых горят глаза.<br className="desktop-break" /> Приедем и устроим всё на вашей площадке.</p><div className="hero-actions"><ChooseButton>Помогите выбрать праздник</ChooseButton><Link className="text-link" href="#transformers">Посмотреть программы <ArrowUpRight size={18} /></Link></div><div className="hero-messengers"><span>Удобнее написать?</span><MessengerLinks /></div><div className="hero-guarantee"><span><ShieldCheck size={21} /></span><div><strong>Оплата после праздника</strong><p>Не понравится — можете не платить.</p></div></div></div>
      <div className="hero-art"><span className="hero-spark" aria-hidden="true">✳</span><div className="hero-photo"><HomeHeroImage /><div className="photo-label"><i /> Вот ради этих глаз — всё и затеваем</div></div><div className="hero-sticker"><span>Осторожно:</span><strong>будет<br />восторг!</strong><Sparkles size={19} /></div><Link href={bumblebee ? "/transformers/bumblebee" : "/transformers"} className="hero-offer"><div><span>Бамблби + супергерой</span><strong>{bumblebee && basePrice(bumblebee) ? rubles(basePrice(bumblebee)!) : "Уточнить цену"} <small>/ 1 час</small></strong></div><span className="offer-arrow"><ArrowUpRight size={24} /></span></Link></div>
    </section>
    <div className="benefit-strip container"><span><MapPin size={20} /> Праздник там, где удобно вам</span><span><Heart size={20} /> Подход к детям от 2 до 16 лет</span><span><BadgeCheck size={20} /> Реальные костюмы на фотографиях</span></div>
    <section className="section container home-showcase" id="transformers" aria-labelledby="transformers-title">
      <div className="section-head"><div><span className="eyebrow">Супергеройский масштаб</span><h2 id="transformers-title">Они большие.<br />Эмоции — <em>ещё больше.</em></h2></div><Link href="/transformers" className="text-link">Все большие герои <ArrowUpRight size={18} /></Link></div>
      <PhotoCarousel id="home-transformers" label="Большие герои">{offerings.filter(item => item.kind === "transformer").map(item => <HomeTransformerCard key={item.slug} offering={item} />)}</PhotoCarousel>
      <p className="home-section-note">Два героя в программе. Для праздника дома заранее проверим потолки, проходы и свободное место.</p>
    </section>
    <section className="section container home-showcase" aria-labelledby="characters-title">
      <div className="section-head"><div><span className="eyebrow">Кто сегодня придёт в гости?</span><h2 id="characters-title">Любимый герой.<br /><em>Лично. На празднике.</em></h2></div><Link href="/characters" className="button outline">Весь каталог персонажей <ArrowUpRight size={18} /></Link></div>
      <p className="home-animation-price">Аниматор с любимым героем{animation?.duration_minutes ? ` · ${duration(animation.duration_minutes)}` : ""}{animation && basePrice(animation) !== undefined ? ` · ${rubles(basePrice(animation)!)}` : " · стоимость уточним"}. <Link href="/animators">Что входит в программу <ArrowUpRight size={15} /></Link></p>
      <PhotoCarousel id="home-characters" label="Любимые герои" variant="characters">{featuredCharacters.map((character, index) => <CharacterCard key={character.slug} character={character} index={index} />)}</PhotoCarousel>
    </section>
    <SeasonalOffer offering={offerings.find(item => item.slug === "new-year")} />
    <section className="packages-section home-showcase" aria-labelledby="packages-title"><div className="container section">
      <div className="section-head"><div><span className="eyebrow">Игры и шоу вместе</span><h2 id="packages-title">Один пакет.<br /><em>Много «вау!»</em></h2></div><Link className="button outline" href="/packages">Все пакеты <ArrowUpRight size={18} /></Link></div>
      <PhotoCarousel id="home-packages" label="Пакеты праздников">{featuredPackages.map(item => <HomePackageCard key={item.slug} offering={item} offerings={offerings} />)}</PhotoCarousel>
      <p className="home-section-note">Время указано для игр и шоу с ведущим, без фоновой музыки после программы. Дополнения и выезд в удалённые районы согласуем до заказа.</p>
    </div></section>
    <section className="section container home-showcase" aria-labelledby="occasions-title">
      <div className="section-head"><div><span className="eyebrow">Праздник объединяет</span><h2 id="occasions-title">Для всей группы.<br /><em>Для каждого ребёнка.</em></h2></div><Link href="/holidays" className="text-link">Все праздники для групп <ArrowUpRight size={18} /></Link></div>
      <PhotoCarousel id="home-occasions" label="Праздники для групп">{occasions.map(item => <HomeOccasionCard key={item.slug} occasion={item} />)}</PhotoCarousel>
    </section>
    <section className="memory-section"><div className="container memory-layout"><div className="memory-copy"><span className="eyebrow">Такие моменты не придумаешь</span><h2>Сначала —<br /><em>«ничего себе!»</em><br />Потом — «хочу ещё!»</h2><p>Наши костюмы, игры и настоящие праздники. Посмотрите, как это бывает у других семей.</p><Link href="/gallery" className="button navy">Посмотреть фотографии <ArrowUpRight size={18} /></Link></div><div className="memory-photos"><Image sizes="(max-width: 900px) 100vw, 700px" className="memory-one" src="/media/party-colour.jpg" alt="Весёлые игры с детьми на празднике" loading="lazy" width="600" height="450" /><Image sizes="(max-width: 900px) 100vw, 700px" className="memory-two" src="/media/party-friends.jpg" alt="Дети играют вместе с аниматором" loading="lazy" width="450" height="600" /><span className="memory-label">Вот оно, счастливое детство ✳</span></div></div></section>
    {reviews.length > 0 && <section className="section container home-showcase" aria-labelledby="reviews-title"><div className="section-head"><h2 id="reviews-title">Родители рассказывают.</h2><Link className="text-link" href="/reviews">Все отзывы <ArrowUpRight size={18} /></Link></div><PhotoCarousel id="home-reviews" label="Отзывы родителей" variant="reviews">{reviews.slice(0, 3).map((review, index) => <div key={`${review.author}-${index}`} className="home-review"><ReviewCards reviews={[review]} /></div>)}</PhotoCarousel></section>}
    <section className="section container faq-section"><div><span className="eyebrow">Родителям — спокойно</span><h2>Родителям —<br /><em>понятные ответы.</em></h2><div className="guarantee-card"><ShieldCheck size={27} /><h3>Гарантия хорошего праздника</h3><p>Оплата после проведения.<br />Не понравится — можете не платить.</p></div></div><div className="faq-list">{[
      ["Где можно провести праздник?", "Дома, в кафе, детском саду, школе, детской студии, на природе или на улице — мы работаем на выезде. Игры подберём под вашу площадку, а условия проведения на открытом воздухе согласуем по сезону и погоде. Для трансформеров в помещении нужны потолки от 2,30 м, подходящие проходы и свободное место."],
      ["Если ребёнок стесняется?", "Начнём со спокойного знакомства и мягких игр. Темп увеличиваем постепенно, когда ребёнку комфортно включаться."],
      ["Сколько детей может участвовать?", "Работаем с компаниями от одного до 150 детей в разных форматах. Для большой группы подбираем число ведущих, игры и звук отдельно."],
      ["Можно добавить шоу к трансформерам?", "Да: азотное, серебряное шоу или сладкую вату. Обсудим последовательность и рассчитаем программу с учётом двух участников команды."],
      ["Выезд уже входит в цену?", "Для удалённых адресов, в том числе Весеннего и Южного, возможна доплата. Стоимость дороги уточним по адресу до заказа."],
    ].map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className="container final-cta"><span className="cta-doodle" aria-hidden="true">✳</span><div><span className="eyebrow">Начнём с вашей идеи</span><h2>Какой праздник<br />придумаем <em>для вас?</em></h2><p>Расскажите о ребёнке. Остальное обсудим вместе.</p></div><ChooseButton className="button navy">Обсудить мой праздник</ChooseButton></section>
  </main>;
}
