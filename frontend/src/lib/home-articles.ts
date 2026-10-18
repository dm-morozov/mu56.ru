import type { Article } from "./editorial";

// The homepage answers booking questions first; /articles keeps the full feed.
const planningArticles = [
  "kak-vybrat-programmu",
  "kak-vybrat-geroya",
  "podgotovka-k-priezdu-animatora",
];

export function homeArticles(articles: Article[]): Article[] {
  const selected = planningArticles.flatMap(slug => {
    const article = articles.find(item => item.slug === slug);
    return article ? [article] : [];
  });
  const seen = new Set(selected.map(article => article.slug));
  for (const article of articles) {
    if (!seen.has(article.slug)) {
      selected.push(article);
      seen.add(article.slug);
    }
    if (selected.length >= 3) break;
  }
  return selected.slice(0, 3);
}
