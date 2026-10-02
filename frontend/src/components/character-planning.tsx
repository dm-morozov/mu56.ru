import Link from "next/link";
import { Character, Offering, basePrice, rubles } from "@/lib/types";
const priority = ["full-party", "ice-breath", "sweet-vibe"];
const rank = (slug: string) => { const index = priority.indexOf(slug); return index < 0 ? priority.length : index; };

export function CharacterPlanning({character, offerings}: {character:Character; offerings:Offering[]}) {
  const packages = offerings.filter(item => item.kind === "package" && item.characters.some(hero => hero.slug === character.slug))
    .sort((a,b) => rank(a.slug) - rank(b.slug)).slice(0,3);
  return <section className="container character-planning" aria-labelledby="character-planning-title">
    <div className="section-head"><div><span className="eyebrow">Герой выбран. Что дальше?</span><h2 id="character-planning-title">Добавьте празднику <em>впечатлений</em></h2></div><p>{character.name} может провести анимацию в составе пакета с шоу. Состав и доступность согласуем для вашей даты.</p></div>
    {packages.length > 0 && <div className="character-package-links">{packages.map(item => <Link key={item.slug} href={`/packages/${item.slug}`}><strong>{item.name}</strong><span>{item.parts.filter(part=>part.led_by_performer).map(part=>part.title).join(" · ")}</span><b>{basePrice(item) ? rubles(basePrice(item)!) : "Стоимость уточним"}</b></Link>)}</div>}
    <Link className="text-link" href="/packages#compare">Сравнить все пакеты →</Link>
    <div className="character-parent-help"><div><h2>Перед встречей с героем</h2><details><summary>Где можно провести праздник?</summary><p>Выезжаем домой, в кафе, детские сады, школы, детские студии и на открытые площадки в Оренбурге. Пространство, погоду для праздника на улице и формат игр обсуждаем заранее. Удалённый выезд рассчитывается отдельно.</p></details><details><summary>Если ребёнок стесняется?</summary><p>Начинаем с аккуратного знакомства и спокойных игр, затем постепенно повышаем темп. Программу подбираем по возрасту и реакции детей; принуждать ребёнка участвовать не нужно.</p></details><details><summary>Для какого возраста и компании?</summary><p>Работаем с детьми от 2 до 16 лет. Формат зависит от возраста, интересов и числа гостей: для большой компании отдельно согласуем количество ведущих и звуковое оборудование.</p></details></div><aside><span className="eyebrow">Поможем подготовиться</span><Link href="/articles/kak-vybrat-programmu">Аниматор или пакет с шоу: как выбрать программу →</Link><Link href="/articles/esli-rebenok-stesnyaetsya">Если ребёнок стесняется аниматора →</Link><Link href="/characters">Посмотреть других персонажей →</Link></aside></div>
  </section>;
}
