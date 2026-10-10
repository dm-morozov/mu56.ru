import Image from "next/image";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import { ChooseButton } from "@/components/choose-button";
import { pageMetadata } from "@/lib/seo";
import styles from "./venues.module.css";

export const metadata = pageMetadata("Площадки для детского праздника в Оренбурге", "Знакомые площадки, где команда «Мира Улыбок» проводит детские праздники. Фотографии, адреса и программы; условия площадки согласуем отдельно.", "/venues");

const venues = [{
  href: "/venues/vinni-puh",
  name: "Кондитерский дом «Винни-Пух»",
  address: "Оренбург, ул. Ульянова, 81",
  image: "/media/venues/vinni-puh/cover.webp",
  description: "Знакомая площадка, где мы проводим праздники с героями, играми и шоу. Посмотрите фотографии наших праздников и варианты программы.",
}];

export default function VenuesPage() {
  return <main id="main">
    <PageIntro path="/venues" breadcrumbLabel="Площадки для праздника" title="Площадки для праздника" eyebrow="Где можно встретиться" description="Здесь собраны знакомые нам места в Оренбурге, где мы проводим детские праздники. Выбирайте площадку и программу — свободную дату и условия согласуем заранее." />
    <section className={`container ${styles.list}`} aria-label="Рекомендуемые площадки">
      {venues.map(venue => <article className={styles.card} key={venue.href}>
        <Link className={styles.photo} href={venue.href} aria-label={`Фотографии и программы: ${venue.name}`}><Image src={venue.image} alt="Игра с героем на празднике в «Винни-Пухе»" width={900} height={600} sizes="(max-width:700px) 100vw, 600px" loading="eager" /></Link>
        <div className={styles.copy}><span className="eyebrow">{venue.address}</span><h2><Link href={venue.href}>{venue.name}</Link></h2><p>{venue.description}</p><Link className="button outline" href={venue.href}>Фотографии и программы →</Link></div>
      </article>)}
      <p className={styles.note}>Площадка, торт и угощения оплачиваются отдельно от программы «Мира Улыбок». Возможность выбранных шоу уточняем с площадкой.</p>
    </section>
    <section className="container final-cta"><div><h2>Уже выбрали другое место?</h2><p>Мы работаем на выезде. Расскажите о площадке, возрасте детей и вашей идее праздника.</p></div><ChooseButton>Обсудить праздник</ChooseButton></section>
  </main>;
}
