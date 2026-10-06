import { getReviews } from "@/lib/editorial";
import { ReviewCards } from "@/components/editorial-cards";
import { PageIntro } from "@/components/page-intro";
import { ChooseButton } from "@/components/choose-button";

export const metadata = { title: "Отзывы родителей", description: "Отзывы клиентов «Мира Улыбок» о детских праздниках в Оренбурге: знакомство с героями, игры и впечатления детей.", alternates: { canonical: "/reviews" } };
export default async function ReviewsPage() {
  const reviews = await getReviews();
  return <main id="main"><PageIntro path="/reviews" breadcrumbLabel="Отзывы" title="После праздника остаются эмоции." eyebrow="Слово родителям" description="Реальные отзывы клиентов о встречах с героями и праздниках. Спасибо, что делитесь впечатлениями." /><section className="container editorial-list">{reviews.length ? <ReviewCards reviews={reviews} /> : <p>Отзывы скоро появятся. Пока можно посмотреть фотографии наших праздников.</p>}</section><section className="container final-cta"><div><h2>Теперь устроим<br />ваш праздник?</h2><p>Расскажите, кого мечтает встретить ребёнок.</p></div><ChooseButton>Подобрать программу</ChooseButton></section></main>;
}
