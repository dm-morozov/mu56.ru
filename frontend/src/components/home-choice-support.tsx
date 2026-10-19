import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Review } from "@/lib/editorial";
import { ChooseButton } from "./choose-button";
import styles from "./home-choice-support.module.css";

const criteria = [
  {
    title: "Возраст и интересы",
    text: "Игры и темп подбираем по возрасту и интересам детей. Если ребёнок стесняется, начинаем со спокойного знакомства и не заставляем участвовать.",
  },
  {
    title: "Размер компании",
    text: "Число детей влияет на игры, состав команды и звук. Эти детали согласуем заранее.",
  },
  {
    title: "Место праздника",
    text: "Обычная анимация возможна и в квартире: заранее обсудим свободное место. Условия для больших героев и шоу уточняем отдельно.",
  },
  {
    title: "Время и состав",
    text: "Сравнивайте время игр и шоу с ведущим: фоновая музыка в него не входит. Дополнительные услуги и удалённый выезд согласуем до заказа.",
  },
];

export function HomeChoiceSupport({ review }: { review?: Review }) {
  return <section data-choice-support className={`${styles.support}${review ? ` ${styles.withReview}` : ""}`} aria-labelledby="home-choice-support-title">
    {review && <figure data-choice-review className={styles.review}>
      <span className={styles.reviewLabel}>Из отзыва на Авито</span>
      <blockquote cite={review.source_url}>{review.text}</blockquote>
      <figcaption>
        <strong>{review.author}</strong>
        <a href={review.source_url} target="_blank" rel="noopener noreferrer">Профиль с отзывами на Авито<ArrowUpRight size={16} aria-hidden="true" /></a>
      </figcaption>
    </figure>}
    <div className={styles.guide}>
      <h3 id="home-choice-support-title">Что поможет выбрать программу</h3>
      <div className={styles.help}>
        <p>Оставьте контакт — обсудим пожелания. Заявка сама по себе не бронирует праздник.</p>
        <ChooseButton className={`button navy ${styles.helpButton}`}>Помогите выбрать</ChooseButton>
      </div>
      <div className={styles.criteria}>
        {criteria.map(criterion => <details key={criterion.title}>
          <summary>{criterion.title}</summary>
          <p>{criterion.text}</p>
        </details>)}
      </div>
      <Link href="/articles/kak-vybrat-programmu" className={styles.articleLink}>Аниматор или пакет с шоу: как выбрать программу<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
  </section>;
}
