import Image from "next/image";
import Link from "next/link";
import { Clock3, ShieldCheck, Users } from "lucide-react";
import { packageImage } from "@/lib/images";
import { getOccasion } from "@/lib/occasions";
import { packagePrice, packageTiming } from "@/lib/packages";
import { duration, rubles, type Offering } from "@/lib/types";
import { ChooseButton } from "./choose-button";
import { packageStageCondition } from "./package-stage-condition";
import styles from "./package-details.module.css";

type PackageDetailsProps = {
  offering: Offering;
  allOfferings: Offering[];
  occasion?: NonNullable<ReturnType<typeof getOccasion>>;
};

export function PackageDetails({ offering, allOfferings, occasion }: PackageDetailsProps) {
  const price = packagePrice(offering, allOfferings, occasion?.soundRequired);
  const timing = packageTiming(offering);
  const activeParts = offering.parts.filter(part => part.led_by_performer);
  const approximateBackground = offering.parts.some(part => !part.led_by_performer && part.is_approximate);
  const image = packageImage(offering.slug);
  const stageConditions = offering.parts.flatMap(part => {
    const service = allOfferings.find(item => item.slug === part.service_slug);
    const condition = packageStageCondition(service);
    return condition && service ? [{ slug: service.slug, condition }] : [];
  });
  const addon = offering.prices.find(item => item.context === "with_animation");
  const secondPerformerPrices = offering.prices.filter(item => item.context === "second_performer");

  return <div className={`container ${styles.layout}`}>
    <section className={styles.summary} aria-labelledby="package-summary-title" data-package-summary={offering.slug}>
      <h2 id="package-summary-title">Что входит в пакет</h2>
      <ul className={styles.composition} aria-label="Игры и шоу в пакете">
        {activeParts.map(part => <li key={part.position}>{part.title}</li>)}
      </ul>
      <div className={styles.facts}>
        <span><Clock3 size={18} aria-hidden="true" /><span><strong>{timing.approximate ? "≈ " : ""}{duration(timing.active)}</strong><small>игры и шоу</small></span></span>
        <span><Users size={18} aria-hidden="true" /><span><strong>{offering.included_performers} {offering.included_performers === 1 ? "аниматор" : "участника команды"}</strong><small>в стоимости пакета</small></span></span>
      </div>
      <div className={styles.price} data-package-price>
        <strong>{price.total !== undefined ? rubles(price.total) : "Цену уточним"}</strong>
        <span>{occasion?.soundRequired ? "за программу со звуком" : "за программу"}</span>
      </div>
      {stageConditions.map(stage => <p key={stage.slug} className={`${styles.requirements} package-stage-condition`}>{stage.condition} <Link href={`/shows/${stage.slug}`}>Условия шоу →</Link></p>)}
      <ChooseButton
        offering={offering.slug}
        addons={occasion && price.addonSound ? ["sound"] : undefined}
        soundRequired={occasion?.soundRequired}
        className={`button orange ${styles.choose}`}
      >{occasion ? "Выбрать пакет для группы" : "Хочу эту программу"}</ChooseButton>
      <div className={styles.terms}>
        <ShieldCheck size={17} aria-hidden="true" />
        <p>Оплата после праздника. Не понравится — можете не платить.<br />Удалённый выезд оплачивается отдельно, стоимость уточним по адресу.</p>
      </div>
      {timing.background > 0 && <p className={styles.background}>После программы: {approximateBackground ? "около " : ""}{duration(timing.background)} фоновой музыки — без ведущего.</p>}
      {occasion && <div className={styles.requirements}>
        <strong>{occasion.title}</strong>
        <p>{occasion.soundRequired ? "Комплект мощного звука с двумя микрофонами включён в итоговую цену. В программе один аниматор; если детей больше 20, рекомендуем второго — он оплачивается отдельно." : "В цене один аниматор. Комплект мощного звука и второй аниматор добавляются по желанию. Если детей больше 20, рекомендуем второго аниматора; если больше 30 — комплект звука."}</p>
        {occasion.soundRequired && <p>Базовый пакет: {price.base !== undefined ? rubles(price.base) : "стоимость уточним"}. {price.addonSound ? `Комплект звука: ${price.soundPrice !== undefined ? rubles(price.soundPrice) : "стоимость уточним"}.` : "Звук уже включён в базовый пакет — повторной доплаты нет."}</p>}
      </div>}
      {(addon || secondPerformerPrices.length > 0) && <div className={styles.tariffs}>
        {addon && <div><span>Добавить к анимации</span><strong>+ {rubles(addon.amount_rub)}</strong></div>}
        {secondPerformerPrices.map(item => <div key={item.code}><span>Добавить второго аниматора</span><strong>+ {rubles(item.amount_rub)}</strong></div>)}
      </div>}
      {offering.requirements && <p className={styles.requirements}>{offering.requirements}</p>}
    </section>
    <section className={styles.program} aria-labelledby="package-program-title">
      {image && <div className={styles.photo}><Image src={image} alt={offering.name} width={600} height={400} sizes="(max-width: 800px) 100vw, 600px" /></div>}
      <div className={styles.programBody}>
        <span className="eyebrow">Программа вашего праздника</span>
        <h2 id="package-program-title">Как пройдёт праздник</h2>
        {offering.description && <p className={styles.description}>{offering.description}</p>}
        <ul className="detail-timeline">
          {offering.parts.map(part => <li key={part.position}><strong>{part.title}</strong><span>{part.is_approximate ? "≈ " : ""}{part.duration_minutes} мин</span></li>)}
        </ul>
        <p className={styles.background}>Фоновая музыка играет, пока команда собирает оборудование. На этом этапе никто не ведёт программу.</p>
      </div>
    </section>
  </div>;
}
