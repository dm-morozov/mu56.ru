import "./animators.css";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfferings } from "@/lib/catalog";
import { basePrice, duration, rubles } from "@/lib/types";
import { absoluteUrl, pageMetadata, serviceSchema } from "@/lib/seo";
import { characterImage } from "@/lib/images";
import { CharacterCard, PackageCard } from "@/components/cards";
import { ChooseButton } from "@/components/choose-button";
import { CharacterGallery } from "@/components/character-gallery";
import { StructuredData } from "@/components/structured-data";

const description = "Выездные аниматоры на день рождения и детский праздник в Оренбурге. Любимые персонажи, игры по возрасту, реальные фотографии и пакеты с шоу. Оплата после праздника.";
export const metadata = {
  ...pageMetadata("Аниматоры на день рождения в Оренбурге", description, "/animators"),
  openGraph: { ...pageMetadata("Аниматоры на день рождения в Оренбурге", description, "/animators").openGraph,
    images: [{ url: absoluteUrl(characterImage("spider-man")!), alt: "Аниматор Человек-паук — Мир Улыбок" }] },
};

export default async function AnimatorsPage() {
  const offerings = await getOfferings();
  const animation = offerings.find(item => item.kind === "animation" && item.slug === "animation");
  if (!animation) notFound();
  const price = basePrice(animation);
  const favourites = ["spider-man", "tiktok", "captain-america", "chase"];
  const characters = favourites.flatMap(slug => animation.characters.filter(hero => hero.slug === slug));
  const packages = ["full-party", "ice-breath", "sweet-vibe"].flatMap(slug => offerings.filter(item => item.kind === "package" && item.slug === slug));
  const photos = ["spider-man", "ninja-turtle", "alice"].flatMap(slug => animation.characters.find(hero => hero.slug === slug)?.photos.slice(0, 1) || []);
  const leadPhoto = photos[0];

  return <main id="main" className="animation-page">
    <StructuredData data={serviceSchema(animation, description)} />
    <div className="animation-hero-band"><section className="container animation-hero">
      <div className="animation-hero-copy">
        <Breadcrumbs current={{ label: "Аниматоры", href: "/animators" }} />
        <span className="eyebrow">Любимый герой. Настоящие впечатления.</span>
        <h1>Аниматоры на детский праздник <em>в Оренбурге</em></h1>
        <p>Пусть любимый герой станет частью дня рождения. Приедем на вашу площадку, познакомимся с детьми и увлечём их играми, заданиями и танцами.</p>
        <div className="animation-tariff"><strong>{price ? rubles(price) : "Стоимость уточним"}</strong><span>{duration(animation.duration_minutes)} · {animation.included_performers === 1 ? "один аниматор" : `${animation.included_performers} аниматора`} · герой на выбор</span></div>
        <div className="hero-actions"><ChooseButton offering={animation.slug}>Обсудить праздник</ChooseButton><Link href="#heroes" className="button outline">Выбрать героя</Link></div>
        <p className="animation-venue">Дома, в кафе, саду, школе, детской студии или на улице. Удалённый выезд рассчитываем отдельно.</p>
      </div>
      <div className="animation-hero-photo">
        <Image src={leadPhoto?.url || characterImage("spider-man")!} alt={leadPhoto?.alt || "Аниматор Человек-паук"} width={800} height={900} sizes="(max-width: 680px) 100vw, 50vw" preload />
        <span className="animation-photo-label">Не просто встреча с героем.<br />Общее приключение!</span>
      </div>
    </section></div>

    <div className="animation-program-band"><section className="container animation-program" aria-labelledby="animation-program-title">
      <div className="section-head"><div><span className="eyebrow">У каждого праздника свой темп</span><h2 id="animation-program-title">Игры, в которые хочется <em>включиться</em></h2></div><p>Работаем с детьми от 2 до 16 лет. Образ, сложность заданий и темп подбираем по возрасту и интересам вашей компании.</p></div>
      <div className="animation-steps"><article><span>01</span><h3>Знакомимся</h3><p>Помогаем освоиться рядом с героем. Если ребёнок стесняется, начинаем спокойно и не заставляем участвовать.</p></article><article><span>02</span><h3>Играем вместе</h3><p>Тематические задания, подвижные игры и танцы. Меняем подачу по реакции детей и возможностям площадки.</p></article><article><span>03</span><h3>Сохраняем впечатления</h3><p>Общаемся с героем и оставляем время для ваших фотографий. Профессионального фотографа можно обсудить отдельно.</p></article></div>
    </section></div>

    <section id="heroes" className="container animation-characters" aria-labelledby="animation-heroes-title">
      <div className="section-head"><div><span className="eyebrow">Кого ждёт ваш ребёнок?</span><h2 id="animation-heroes-title">Герои для вашего <em>праздника</em></h2></div><p>Четыре варианта для знакомства — остальные герои есть в каталоге. Посмотрите реальные костюмы и описания. Доступность уточним для вашей даты.</p></div>
      <div className="character-grid">{characters.map((hero, index) => <CharacterCard key={hero.slug} character={hero} index={index} />)}</div>
      <div className="animation-section-links"><Link className="button outline" href="/characters">Посмотреть всех персонажей</Link><Link className="text-link" href="/transformers">Хотите большого робота? Посмотрите трансформеров →</Link></div>
    </section>

    <div className="animation-packages-band"><section className="container animation-packages" aria-labelledby="animation-packages-title">
      <div className="section-head"><div><span className="eyebrow">Если хочется ещё больше</span><h2 id="animation-packages-title">Герой + шоу = <em>целый праздник</em></h2></div><p>Выберите готовую программу с анимацией и шоу. Состав, время и цена указаны в каждом пакете.</p></div>
      <div className="package-grid inner-packages">{packages.map(item => <PackageCard offerings={offerings} key={item.slug} offering={item} featured={item.slug === "full-party"} />)}</div>
      <Link href="/packages#compare" className="text-link">Сравнить все пакеты →</Link>
    </section></div>

    <CharacterGallery name="Аниматоры" photos={photos} />
    <section className="container animation-questions"><div><span className="eyebrow">Чтобы было спокойно родителям</span><h2>Обсудим детали <em>заранее</em></h2><div className="guarantee-card"><strong>Гарантия хорошего праздника</strong><p>Оплата после праздника.<br />Не понравится — можете не платить.</p></div></div><div className="faq-list">
      <details><summary>Хватит ли места дома?</summary><p>Обычная анимация проходит и в квартире. Заранее обсудим свободное пространство, число детей и игры, которые подойдут вашей площадке. У больших героев отдельные условия — они описаны в разделе трансформеров.</p></details>
      <details><summary>Сколько детей может участвовать?</summary><p>Проводим праздники для небольшой компании и больших групп. Количество ведущих и дополнительный звук подбираем по числу гостей и формату. Для сада, школы или выпускного условия согласуем отдельно.</p></details>
      <details><summary>Можно добавить шоу?</summary><p>Да. Посмотрите готовые пакеты с азотным шоу, серебряным шоу или сладкой ватой. Содержание и итоговую стоимость подтвердим при обсуждении заказа.</p></details>
      <details><summary>Что входит в цену анимации?</summary><p>В базовой программе — {duration(animation.duration_minutes)}, {animation.included_performers === 1 ? "один аниматор" : `${animation.included_performers} участника команды`} и выбранный доступный герой. Шоу, фотограф и дополнительный звук согласуются отдельно. Выезд в удалённые районы может оплачиваться отдельно — стоимость уточним по адресу до праздника.</p></details>
      <details><summary>Как заказать аниматора?</summary><p>Оставьте заявку с датой, возрастом ребёнка, местом проведения и пожеланиями к герою. Уточним свободное время, состав и стоимость выезда. Если ещё не выбрали персонажа, поможем подобрать его. Отправка заявки сама по себе не бронирует дату.</p></details>
      <Link href="/articles/esli-rebenok-stesnyaetsya" className="text-link">Если ребёнок стесняется аниматора →</Link>
    </div></section>
    <section className="container final-cta"><div><span className="eyebrow">Первый шаг к празднику</span><h2>Расскажите, кого ждёт <em>ваш ребёнок</em></h2><p>Поможем выбрать героя и программу для вашей компании.</p></div><ChooseButton offering={animation.slug}>Подобрать программу</ChooseButton></section>
  </main>;
}
