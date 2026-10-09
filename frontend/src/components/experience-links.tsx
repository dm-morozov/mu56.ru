import Link from "next/link";
import { getArticles } from "@/lib/editorial";

const stories = ["letnie-prazdniki-na-turbaze", "prazdniki-v-shkolnyh-lageryah"];

export async function ExperienceLinks() {
  const articles = (await getArticles()).filter(article => stories.includes(article.slug));
  if (!articles.length) return null;
  return <aside className="container section" aria-label="Рассказы ведущего">
    <span className="eyebrow">Дмитрий Морозов · Из практики</span>
    <h2>Почему я люблю эти праздники</h2>
    <p>Рассказываю о работе в паре, общих играх и настроении, которое остаётся после встречи.</p>
    <div className="article-related">{articles.map(article => <Link className="text-link" key={article.slug} href={`/articles/${article.slug}`}>{article.title} →</Link>)}</div>
  </aside>;
}
