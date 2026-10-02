import Link from "next/link";
import { Article } from "@/lib/editorial";
import { Offering, basePrice, rubles } from "@/lib/types";
import { offeringUrl } from "@/lib/images";

const suggestions: Record<string, string[]> = {
  "transformer-doma": ["bumblebee", "optimus-prime"],
  "kak-vybrat-programmu": ["animation", "sweet-vibe", "full-party"],
  "esli-rebenok-stesnyaetsya": ["animation"],
};

export function ArticlePlanning({ slug, offerings, articles }: { slug: string; offerings: Offering[]; articles: Article[] }) {
  const programs = (suggestions[slug] || []).map(key => offerings.find(item => item.slug === key && item.availability !== "unavailable"))
    .filter((item): item is Offering => !!item);
  const reading = articles.filter(item => item.slug !== slug).slice(0, 3);
  return <section className="article-planning" aria-label="Программы и материалы по теме">
    {programs.length > 0 && <><h2>Посмотрите подходящие программы</h2><div className="article-program-links">{programs.map(item => {
      const price = basePrice(item);
      return <Link key={item.slug} href={item.kind === "animation" ? "/animators" : offeringUrl(item.kind, item.slug)}><strong>{item.name}</strong><span>{item.kind === "transformer" ? "Большой герой и второй герой в обычном костюме" : item.kind === "package" ? "Анимация и шоу в одной программе" : "Любимый герой, игры и танцы"}</span><b>{price !== undefined ? rubles(price) : "Стоимость уточним"}</b></Link>;
    })}</div><p>Цены — за базовый состав из каталога. Выезд, дополнительные ведущие и итоговый состав согласуем отдельно.</p><Link className="text-link" href="/packages#compare">Сравнить состав и стоимость всех пакетов →</Link></>}
    {reading.length > 0 && <div className="article-related"><h2>Ещё вопросы перед праздником</h2>{reading.map(item => <Link key={item.slug} href={`/articles/${item.slug}`}>{item.title} →</Link>)}</div>}
  </section>;
}
