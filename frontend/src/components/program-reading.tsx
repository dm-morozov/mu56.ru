import Link from "next/link";
import { getArticles } from "@/lib/editorial";
import type { Offering } from "@/lib/types";
import styles from "./program-reading.module.css";

export async function ProgramReading({ offering }: { offering: Pick<Offering, "kind" | "slug"> }) {
  const slugs = offering.kind === "transformer"
    ? ["transformer-doma", "podgotovka-k-priezdu-animatora", "esli-rebenok-stesnyaetsya"]
    : offering.slug === "foam" || offering.slug === "foam-party"
      ? ["podgotovka-pennoj-vecherinki", "letnie-prazdniki-na-turbaze"]
      : offering.kind === "package"
        ? ["kak-vybrat-programmu", "igry-shou-i-tort", "podgotovka-k-priezdu-animatora"]
        : offering.kind === "show"
          ? ["kakoe-shou-dobavit", "igry-shou-i-tort"]
          : [];
  return <PreparationReading slugs={slugs} />;
}

export async function PreparationReading({ slugs }: { slugs: string[] }) {
  if (!slugs.length) return null;

  const available = new Map((await getArticles()).map(article => [article.slug, article]));
  const articles = slugs.flatMap(slug => available.has(slug) ? [available.get(slug)!] : []);
  if (!articles.length) return null;

  return <aside className={`container ${styles.reading}`} aria-label="Подготовка к программе">
    <span className="eyebrow">До встречи на празднике</span>
    <h2>Подготовимся к вашей программе</h2>
    <p>Ответы о площадке, выборе программы и порядке праздника — в коротких памятках для родителей.</p>
    <div className="article-related">{articles.map(article => <Link key={article.slug} href={`/articles/${article.slug}`}>{article.title} →</Link>)}</div>
  </aside>;
}
