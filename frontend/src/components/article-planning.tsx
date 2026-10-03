import Link from "next/link";
import { Article } from "@/lib/editorial";
import { Character, Offering, basePrice, rubles } from "@/lib/types";
import { offeringUrl } from "@/lib/images";

const suggestions: Record<string, string[]> = {
  "transformer-doma": ["bumblebee", "optimus-prime"],
  "kak-vybrat-programmu": ["animation", "sweet-vibe", "full-party"],
  "esli-rebenok-stesnyaetsya": ["animation"],
  "kak-vybrat-geroya": ["bumblebee", "sweet-vibe", "full-party"],
  "igry-shou-i-tort": ["sweet-vibe", "ice-breath", "full-party"],
  "vypusknoy-dlya-gruppy": ["animation", "ice-breath", "full-party"],
};

export function ArticlePlanning({ slug, offerings, articles, characters = [] }: { slug: string; offerings: Offering[]; articles: Article[]; characters?: Character[] }) {
  const programs = (suggestions[slug] || []).map(key => offerings.find(item => item.slug === key && item.availability !== "unavailable"))
    .filter((item): item is Offering => !!item);
  const reading = articles.filter(item => item.slug !== slug).slice(0, 3);
  const heroes = slug === "kak-vybrat-geroya" ? characters.filter(item => ["spider-man", "ninja-turtle"].includes(item.slug) && item.availability !== "unavailable") : [];
  return <section className="article-planning" aria-label="Программы и материалы по теме">
    {slug === "vypusknoy-dlya-gruppy" && <div className="article-character-links"><h2>Соберём выпускной для вашей группы</h2><p>Посмотрите варианты и условия выезда. Число ведущих, звук и итоговый состав обсудим для вашей площадки.</p><Link className="text-link" href="/holidays/graduation">Программы на детский выпускной в Оренбурге →</Link>{offerings.some(item => item.slug === "sound" && item.availability !== "unavailable") && <Link className="text-link" href="/extras/sound">Комплект звука с двумя микрофонами →</Link>}</div>}
    {slug === "kak-vybrat-geroya" && <div className="article-character-links"><h2>Посмотрите реальные образы</h2><p>Откройте страницу героя, чтобы посмотреть костюм и фотографии из доступной галереи.</p>{heroes.map(item => <Link key={item.slug} className="text-link" href={`/characters/${item.slug}`}>{item.name}{item.availability === "check" ? " — доступность уточним" : ""} →</Link>)}<Link className="text-link" href="/characters">Выбрать из всех персонажей →</Link></div>}
    {programs.length > 0 && <><h2>Посмотрите подходящие программы</h2><div className="article-program-links">{programs.map(item => {
      const price = basePrice(item);
      return <Link key={item.slug} href={item.kind === "animation" ? "/animators" : offeringUrl(item.kind, item.slug)}><strong>{item.name}</strong><span>{item.kind === "transformer" ? "Большой герой и второй герой в обычном костюме" : item.kind === "package" ? "Анимация и шоу в одной программе" : "Любимый герой, игры и танцы"}</span><b>{price !== undefined ? rubles(price) : "Стоимость уточним"}</b></Link>;
    })}</div><p>Цены — за базовый состав из каталога. Выезд, дополнительные ведущие и итоговый состав согласуем отдельно.</p><Link className="text-link" href="/packages#compare">Сравнить состав и стоимость всех пакетов →</Link></>}
    {reading.length > 0 && <div className="article-related"><h2>Ещё вопросы перед праздником</h2>{reading.map(item => <Link key={item.slug} href={`/articles/${item.slug}`}>{item.title} →</Link>)}</div>}
  </section>;
}
