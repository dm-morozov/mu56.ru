import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { packagePrice, packageTiming } from "@/lib/packages";
import { type Offering, basePrice, duration, rubles } from "@/lib/types";
import styles from "./package-overview.module.css";

export function PackageOverview({ packages }: { packages: Offering[] }) {
  if (!packages.length) return null;

  return <section id="package-overview" className={styles.overview} aria-labelledby="package-overview-title">
    <div className={styles.header}>
      <div>
        <span className="eyebrow">Главное для выбора</span>
        <h2 id="package-overview-title">Герой и шоу: <em>выберите состав</em></h2>
        <p>Откройте понравившийся пакет, чтобы посмотреть этапы программы и условия.</p>
      </div>
      <Link href="#compare" className={`button navy ${styles.compare}`}>Сравнить пакеты <ArrowDown size={17} aria-hidden="true" /></Link>
    </div>

    <ul className={styles.list}>
      {packages.map(item => {
        const timing = packageTiming(item);
        const price = basePrice(item);
        const composition = item.parts
          .filter(part => part.led_by_performer)
          .map(part => part.title.replace("Аниматор на праздник", "Анимация с героем"));
        const soundIncluded = !packagePrice(item, [], true).addonSound;

        return <li key={item.slug} className={`${styles.option} ${item.slug === "full-party" ? styles.featured : ""}`}>
          <div className={styles.copy}>
            <h3><Link href={`/packages/${item.slug}`} className={styles.packageLink} aria-label={`Состав и условия пакета «${item.name}»`}>
              <span>{item.name}</span><ArrowUpRight size={18} aria-hidden="true" />
            </Link></h3>
            <p className={styles.composition}>{composition.length ? composition.join(" + ") : "Состав программы уточним"}</p>
            {soundIncluded && <p className={styles.sound}>Комплект мощного звука с двумя микрофонами включён.</p>}
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Игры и шоу с ведущим</dt>
              <dd>{timing.active ? `${timing.approximate ? "≈ " : ""}${duration(timing.active)}` : "Время согласуем"}</dd>
            </div>
            <div>
              <dt>Базовая цена</dt>
              <dd>{price !== undefined ? rubles(price) : "Цену уточним"}<span>В команде: {item.included_performers} чел.</span></dd>
            </div>
          </dl>
        </li>;
      })}
    </ul>

    <div className={styles.notes}>
      <p><strong>Фоновая музыка отдельно от времени с ведущим.</strong> Она играет после программы, пока команда собирает оборудование. Аниматоры уже не проводят игры и шоу.</p>
      <p>Дополнительный аниматор и удалённый выезд оплачиваются отдельно. Для большой группы состав команды и звук подбираем отдельно.</p>
    </div>
  </section>;
}
