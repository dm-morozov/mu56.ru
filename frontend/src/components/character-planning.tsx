import Link from "next/link";
import { ProgramExtras } from "./program-extras";
import { Character, Offering } from "@/lib/types";
import { basePrice, rubles } from "@/lib/types";
import { ChooseButton } from "./choose-button";
export function CharacterPlanning({character, offerings}: {character:Character; offerings:Offering[]}) {
  const readyPackage = offerings.find(item => item.slug === "full-party" && item.characters.some(hero => hero.slug === character.slug));
  const packagePrice = readyPackage ? basePrice(readyPackage) : undefined;
  return <section className="container character-planning" aria-labelledby="character-planning-title">
    <div className="section-head"><div><span className="eyebrow">Герой выбран. Что дальше?</span><h2 id="character-planning-title">Добавьте празднику <em>впечатлений</em></h2></div><p>Сначала встреча с героем, затем любимое шоу. Выберите добавку — состав и итог увидите в конструкторе.</p></div>
    <ProgramExtras offering={offerings.find(item => item.kind === "animation")!} offerings={offerings} character={character} />
    {readyPackage && packagePrice !== undefined && <div className="character-ready-package"><div><span className="eyebrow">Или выберите готовый праздник</span><h3>{readyPackage.name} с {character.name === "Человек-паук" ? "Человеком-пауком" : "любимым героем"}</h3><p>Анимация, азотное шоу с мороженым и шоу сладкой ваты. {character.name} уже будет выбран в заявке.</p><strong>{rubles(packagePrice)} <small>за программу</small></strong></div><ChooseButton offering={readyPackage.slug} character={character.slug} className="button outline">Выбрать пакет с этим героем</ChooseButton></div>}
    <Link className="text-link" href="/packages#compare">Сравнить все пакеты →</Link>
    <div className="character-parent-help"><div><h2>Перед встречей с героем</h2><details><summary>Где можно провести праздник?</summary><p>Выезжаем домой, в кафе, детские сады, школы, детские студии и на открытые площадки в Оренбурге. Пространство, погоду для праздника на улице и формат игр обсуждаем заранее. Удалённый выезд рассчитывается отдельно.</p></details><details><summary>Если ребёнок стесняется?</summary><p>Начинаем с аккуратного знакомства и спокойных игр, затем постепенно повышаем темп. Программу подбираем по возрасту и реакции детей; принуждать ребёнка участвовать не нужно.</p></details><details><summary>Для какого возраста и компании?</summary><p>Работаем с детьми от 2 до 16 лет. Формат зависит от возраста, интересов и числа гостей: для большой компании отдельно согласуем количество ведущих и звуковое оборудование.</p></details></div><aside><span className="eyebrow">Поможем подготовиться</span><Link href="/articles/kak-vybrat-programmu">Аниматор или пакет с шоу: как выбрать программу →</Link><Link href="/articles/esli-rebenok-stesnyaetsya">Если ребёнок стесняется аниматора →</Link><Link href="/characters">Посмотреть других персонажей →</Link></aside></div>
  </section>;
}
