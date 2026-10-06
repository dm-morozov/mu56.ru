import { getArticles } from "@/lib/editorial";
import { ArticleCards } from "@/components/editorial-cards";
import { PageIntro } from "@/components/page-intro";

export const metadata = { title: "Идеи и советы для детского праздника", description: "Как выбрать программу, подготовить площадку и познакомить ребёнка с аниматором. Практические советы «Мира Улыбок» для родителей.", alternates: { canonical: "/articles" } };
export default async function ArticlesPage() {
  const articles = await getArticles();
  return <main id="main"><PageIntro path="/articles" breadcrumbLabel="Идеи для родителей" title="Меньше хлопот. Больше праздника." eyebrow="Идеи для родителей" description="Помогаем выбрать программу и подготовиться к встрече с героями. Понятные ответы на вопросы, которые возникают перед праздником." /><section className="container editorial-list">{articles.length ? <ArticleCards articles={articles} /> : <p>Готовим первые полезные материалы. Скоро они появятся здесь.</p>}</section></main>;
}
