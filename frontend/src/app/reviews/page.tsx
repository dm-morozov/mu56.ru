import { getReviews } from "@/lib/editorial";
import { ReviewCards } from "@/components/editorial-cards";
import { PageIntro } from "@/components/page-intro";
import { ChooseButton } from "@/components/choose-button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Отзывы об аниматорах и детских праздниках в Оренбурге", "Отзывы родителей о «Мире Улыбок»: дни рождения, праздники в детском саду, трансформеры и шоу. Впечатления детей и взрослых со ссылками на профиль Авито.", "/reviews");
export default async function ReviewsPage() {
  const reviews = await getReviews();
  const avitoProfile = reviews.find(review => review.source_label === "Avito" && review.source_url)?.source_url;
  return <main id="main"><PageIntro path="/reviews" breadcrumbLabel="Отзывы" title="После праздника остаются эмоции." eyebrow="Слово родителям" description="Отзывы родителей о наших аниматорах в Оренбурге: первые дни рождения малышей, встречи с трансформерами, игры и шоу в детском саду и на улице. О том, что запомнилось детям и взрослым, — словами самих гостей." /><section className="container editorial-list">{avitoProfile && <div className="reviews-source"><p>Эти отзывы родители оставили на Авито. Сохранили имена и слова авторов. Ссылки ведут в профиль с отзывами.</p><a href={avitoProfile} className="text-link">Посмотреть все отзывы на Авито ↗</a></div>}{reviews.length ? <ReviewCards reviews={reviews} /> : <p>Отзывы скоро появятся. Пока можно посмотреть фотографии наших праздников.</p>}</section><section className="container final-cta"><div><h2>Теперь устроим<br />ваш праздник?</h2><p>Расскажите, кого мечтает встретить ребёнок.</p></div><ChooseButton>Подобрать программу</ChooseButton></section></main>;
}
