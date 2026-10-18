import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { basePrice, duration, rubles, type Offering } from "@/lib/types";
import "./home-service-navigation.css";

const directions = [
  { href: "/transformers", title: "Трансформеры", detail: "Большие герои" },
  { href: "/animators", title: "Аниматоры", detail: "Игры с героем" },
  { href: "/packages", title: "Пакеты с шоу", detail: "Герой и шоу" },
  { href: "/shows", title: "Все услуги", detail: "Шоу, фото и звук" },
  { href: "/new-year", title: "Новый год", detail: "Дед Мороз и Снегурочка" },
  { href: "/holidays", title: "Для группы", detail: "Сад, школа, выпускной" },
];

export function HomeServiceNavigation({ animation }: { animation?: Offering }) {
  const animationPrice = animation ? basePrice(animation) : undefined;
  const animationSummary = animation && animationPrice !== undefined
    ? [animation.duration_minutes ? duration(animation.duration_minutes) : null, rubles(animationPrice)].filter(Boolean).join(" · ")
    : null;
  return <section id="home-services" className="container home-service-navigation" aria-labelledby="home-service-navigation-title">
    <h2 id="home-service-navigation-title">Какой праздник вы ищете?</h2>
    <nav aria-label="Направления праздников">
      <ul className="home-service-navigation-list">
        {directions.map(({ href, title, detail }) => <li key={href}>
          <Link className="home-service-navigation-link" href={href}>
            <strong>{title}</strong>
            <span>{detail}</span>
            <ArrowUpRight size={17} aria-hidden="true" />
            {href === "/animators" && animationSummary && <small className="home-service-price">{animationSummary} · за программу</small>}
          </Link>
        </li>)}
      </ul>
    </nav>
  </section>;
}
