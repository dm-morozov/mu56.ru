import Link from "next/link";
import { PackageCard } from "@/components/cards";
import { PageIntro } from "@/components/page-intro";
import { ChooseButton } from "@/components/choose-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { getOfferings } from "@/lib/catalog";
import { basePrice, duration, rubles } from "@/lib/types";
import { pageMetadata } from "@/lib/seo";
import styles from "./venue.module.css";
import { venuePhotos } from "./photos";

export const metadata = {
  ...pageMetadata("Детский праздник в «Винни-Пухе»", "Праздники с командой «Мира Улыбок» в кондитерском доме «Винни-Пух» на Ульянова, 81: анимация, выбор программы и согласование площадки.", "/venues/vinni-puh"),
};

export default async function VinniPuhPage() {
  const offerings = await getOfferings();
  const animation = offerings.find(item => item.slug === "animation" && item.kind === "animation");
  const packages = ["sweet-vibe", "ice-breath", "full-party"].flatMap(slug => offerings.filter(item => item.slug === slug && item.kind === "package"));
  const price = animation ? basePrice(animation) : undefined;

  return <main id="main">
    <PageIntro path="/venues/vinni-puh" breadcrumbLabel="Праздники в «Винни-Пухе»" parents={[{ label: "Площадки для праздника", href: "/venues" }]} eyebrow="Площадка, где мы проводим праздники" title="Детский праздник в «Винни-Пухе»" description="" />
    <section className={`container ${styles.hero}`} aria-labelledby="venue-animation">
      <PhotoGallery className={styles.gallery} photos={venuePhotos} layout="carousel" title="Наши праздники в «Винни-Пухе»" description="Игры и встречи с героями на знакомой площадке." />
      <div className={styles.heroCopy}>
        <span className="eyebrow">Праздник с «Миром Улыбок»</span>
        <h2 id="venue-animation">Анимация с любимым героем</h2>
        <p>Встречаемся с детьми в «Винни-Пухе», знакомимся, играем и танцуем. Вы выбираете героя, а мы подбираем игры и темп программы по возрасту и интересам ребят.</p>
        <p>Начнём с анимации — при желании добавим шоу или выберем готовый пакет. Дату и условия проведения согласуем заранее.</p>
        {animation && price !== undefined && <p className={styles.price}>от {rubles(price)} <span>· {duration(animation.duration_minutes)}</span></p>}
        {animation && <ChooseButton offering={animation.slug}>Обсудить программу</ChooseButton>}
        <Link className="text-link" href="/animators">Выбрать героя и посмотреть состав →</Link>
      </div>
    </section>
    <section className={`container ${styles.introduction}`} aria-labelledby="venue-recommendation">
      <div className={styles.recommendation}>
        <span className="eyebrow">Рекомендация Дмитрия</span>
        <h2 id="venue-recommendation">Знакомая площадка для вашего праздника</h2>
        <p>Я рекомендую рассмотреть «Винни-Пух», если вы выбираете место для детского праздника. Мы сотрудничаем с кондитерским домом и уже проводим здесь наши программы.</p>
        <p>С командой «Мира Улыбок» можно обсудить героя, игры и шоу. Дату, время и возможность выбранной программы на этой площадке согласуем заранее.</p>
        <p className={styles.signature}>Дмитрий Морозов · основатель «Мира Улыбок»</p>
      </div>
      <aside className={styles.address} aria-label="О площадке">
        <span className="eyebrow">Кондитерский дом «Винни-Пух»</span>
        <h2>Оренбург,<br />Ульянова, 81</h2>
        <p>«Винни-Пух» — кондитерский дом с тортами на заказ и пирожными. На своём сайте команда рассказывает о собственных рецептурах, сочетании классических традиций и современных подходов к оформлению.</p>
        <p>Торт и угощения можно обсудить с кондитерским домом, а героя, игры и шоу — с нами.</p>
        <a className="text-link" href="https://winnipuhtort.ru/" target="_blank" rel="noopener noreferrer">Посмотреть сайт «Винни-Пуха» ↗</a>
        <a className="text-link" href="https://winnipuhtort.ru/kontakty/" target="_blank" rel="noopener noreferrer">Адрес и контакты площадки ↗</a>
      </aside>
    </section>
    <section className={`container ${styles.section}`} aria-labelledby="venue-programs">
      <span className="eyebrow">Программа от «Мира Улыбок»</span>
      <h2 id="venue-programs">Что будем делать на празднике?</h2>
      <p className={styles.lead}>Начнём с возраста и интересов детей. Можно выбрать анимацию с любимым героем или обсудить несколько этапов — игры и подходящие шоу.</p>
      <div className={styles.programs}>
        {packages.map(offering => <PackageCard key={offering.slug} offering={offering} offerings={offerings} />)}
      </div>
      <p className={styles.note}>Возможность выбранных шоу в помещении согласуем с площадкой заранее.</p>
    </section>
    <section className={`container ${styles.section}`} aria-labelledby="venue-planning">
      <h2 id="venue-planning">Как договориться о празднике</h2>
      <ol className={styles.steps}>
        <li><h3>Уточните место и время</h3><p>Обсудите с «Винни-Пухом» свободную дату и условия площадки. Торт и угощения выбираются отдельно.</p></li>
        <li><h3>Расскажите нам о детях</h3><p>Сообщите дату, возраст и число гостей, любимого героя и желаемую длительность. Укажите, что рассматриваете Ульянова, 81.</p></li>
        <li><h3>Согласуем программу</h3><p>Уточним место для игр, условия выбранных шоу и порядок программы, чтобы игры и торт удобно вписались в праздник.</p></li>
      </ol>
      <p className={styles.note}>Условия и стоимость площадки, торта и развлекательной программы уточняются отдельно. Цены программ «Мира Улыбок» не означают, что в них включены зал или угощения.</p>
    </section>
    <section className="container final-cta"><div><h2>Хотите праздник в «Винни-Пухе»?</h2><p>Расскажите о вашей идее. Подберём программу и обсудим возможность проведения на этой площадке.</p></div><ChooseButton>Обсудить праздник</ChooseButton></section>
  </main>;
}
