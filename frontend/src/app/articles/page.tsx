import { getArticles } from "@/lib/editorial";
import { ArticleCards } from "@/components/editorial-cards";
import { PageIntro } from "@/components/page-intro";
import { articleStories } from "@/lib/article-stories";
import styles from "@/components/topic-navigation.module.css";

export const metadata = { title: "Идеи и советы для детского праздника", description: "Как выбрать программу, подготовить площадку и познакомить ребёнка с аниматором. Практические советы «Мира Улыбок» для родителей.", alternates: { canonical: "/articles" } };
export default async function ArticlesPage() {
  const articles = await getArticles();
  const preparation = new Set(["podgotovka-k-priezdu-animatora", "podgotovka-pennoj-vecherinki", "transformer-doma", "esli-rebenok-stesnyaetsya", "igry-shou-i-tort", "vypusknoy-dlya-gruppy"]);
  const groups = [
    { id: "choice", title: "Выбор", items: articles.filter(article => !articleStories[article.slug] && !preparation.has(article.slug)) },
    { id: "preparation", title: "Подготовка", items: articles.filter(article => !articleStories[article.slug] && preparation.has(article.slug)) },
    { id: "experience", title: "Из практики", items: articles.filter(article => articleStories[article.slug]) },
  ].filter(group => group.items.length);
  return <main id="main"><PageIntro path="/articles" breadcrumbLabel="Идеи для родителей" title="Меньше хлопот. Больше праздника." eyebrow="Идеи для родителей" description="Помогаем выбрать программу и подготовиться к встрече с героями. Понятные ответы на вопросы, которые возникают перед праздником." /><div className="container editorial-list">{articles.length ? <><nav className={styles.navigation} aria-label="Темы статей">{groups.map(group => <a key={group.id} href={`#${group.id}`}>{group.title}</a>)}</nav>{groups.map((group, index) => <section key={group.id} id={group.id} className={styles.topic}><h2>{group.title}</h2><ArticleCards articles={group.items} headingLevel={3} startIndex={groups.slice(0, index).reduce((total, previous) => total + previous.items.length, 0)} /></section>)}</> : <p>Готовим первые полезные материалы. Скоро они появятся здесь.</p>}</div></main>;
}
