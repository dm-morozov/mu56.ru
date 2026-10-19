import Link from "next/link";
import { ArrowUpRight, Camera, MessageCircle } from "lucide-react";
import { basePrice, duration, rubles, type Offering } from "@/lib/types";
import { packageTiming } from "@/lib/packages";
import { programmeRange } from "@/lib/programme-range";
import type { Review } from "@/lib/editorial";
import { homeReview } from "@/lib/home-review";
import { HomeChoiceSupport } from "./home-choice-support";
import "./home-service-navigation.css";

const formats = [
  {
    kind: "animation", href: "/animators", title: "Аниматор с любимым героем", tag: "Для встречи с любимым персонажем",
    description: "Тематические игры, задания и танцы. Вы выбираете героя, программу подбираем по возрасту детей.",
    action: "Герои и программа", timeLabel: "Игры с героем",
  },
  {
    kind: "transformer", href: "/transformers", title: "Большой герой + супергерой", tag: "Для встречи с большим героем",
    description: "Бамблби, Оптимус или Железный человек вместе со вторым героем в обычном костюме. Игры, общение и фотографии.",
    action: "Большие герои и цены", timeLabel: "Программа с двумя героями",
  },
  {
    kind: "package", href: "/packages", title: "Аниматор + шоу", tag: "Для праздника с продолжением",
    description: "Любимый герой и одно или несколько шоу в готовой программе. Сравните сладкую вату, опыты, серебряное и пенное шоу.",
    action: "Сравнить пакеты", timeLabel: "Игры и шоу с ведущим",
  },
];

function rangeSummary(items: Offering[], kind: string) {
  const price = programmeRange(items.map(basePrice));
  const times = items.map(item => {
    if (kind === "package") { const timing = packageTiming(item); return { minutes: timing.active, approximate: timing.approximate }; }
    return { minutes: item.duration_minutes, approximate: item.duration_is_approximate };
  });
  const time = programmeRange(times.map(item => item.minutes));
  const timeLabel = (minutes: number) => `${times.some(item => item.minutes === minutes && item.approximate) ? "≈ " : ""}${duration(minutes)}`;
  const number = new Intl.NumberFormat("ru-RU");
  return {
    price: price ? price.min === price.max ? rubles(price.min) : `${number.format(price.min)}–${rubles(price.max)}` : "Цену уточним",
    time: time ? time.min === time.max ? timeLabel(time.min) : `${timeLabel(time.min)} — ${timeLabel(time.max)}` : "Время согласуем",
  };
}

export function HomeServiceNavigation({ offerings, reviews = [] }: { offerings: Offering[]; reviews?: Review[] }) {
  return <section id="home-services" className="container home-service-navigation" aria-labelledby="home-service-navigation-title">
    <div className="home-choice-heading"><span className="eyebrow">Сначала — формат праздника</span><h2 id="home-service-navigation-title">Что порадует <em>вашего ребёнка?</em></h2><p>Можно пригласить любимого героя, встретить большого супергероя или объединить игры и шоу. Вот чем отличаются программы.</p></div>
    <nav aria-label="Направления праздников">
      <ul className="home-service-navigation-list">
        {formats.map((format, index) => {
          const summary = rangeSummary(offerings.filter(item => item.kind === format.kind), format.kind);
          return <li key={format.kind} className={`home-format home-format-${format.kind}`}>
            <div className="home-format-top"><span className="home-format-number" aria-hidden="true">0{index + 1}</span><span>{format.tag}</span></div>
            <h3>{format.title}</h3><p className="home-format-description">{format.description}</p>
            <dl className="home-format-facts"><div><dt>{format.timeLabel}</dt><dd>{summary.time}</dd></div><div><dt>Цена за базовую программу</dt><dd className="home-format-price">{summary.price}</dd></div></dl>
            <Link className="button outline home-format-action" href={format.href}>{format.action}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          </li>;
        })}
      </ul>
    </nav>
    <p className="home-choice-terms">Фоновая музыка в пакетах не входит во время игр и шоу. Дополнения и выезд в удалённые районы согласуем до заказа.</p>
    <HomeChoiceSupport review={homeReview(reviews)} />
    <nav className="home-other-formats" aria-label="Другие форматы праздника"><span>Особый повод?</span><Link href="/new-year">Дед Мороз и Снегурочка<ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/holidays">Для сада, школы и большой группы<ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/shows">Все услуги и дополнения<ArrowUpRight size={15} aria-hidden="true" /></Link></nav>
    <div className="home-choice-proof"><span>Посмотрите, как всё бывает:</span><Link href="/gallery"><Camera size={17} aria-hidden="true" />Реальные фотографии</Link><Link href="/reviews"><MessageCircle size={17} aria-hidden="true" />Отзывы родителей</Link></div>
  </section>;
}
