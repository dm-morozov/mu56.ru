import type { Article } from "./editorial";

// Editorial order: useful next questions, rather than the newest posts.
const related: Record<string, readonly string[]> = {
  "letnie-prazdniki-na-turbaze": ["podgotovka-pennoj-vecherinki", "podgotovka-k-priezdu-animatora", "kakoe-shou-dobavit"],
  "prazdniki-v-shkolnyh-lageryah": ["vypusknoy-dlya-gruppy", "animatsiya-po-vozrastu", "kakoe-shou-dobavit"],
  "stoimost-animatora": ["kak-vybrat-programmu", "igry-shou-i-tort", "kakoe-shou-dobavit"],
  "kakoe-shou-dobavit": ["igry-shou-i-tort", "podgotovka-pennoj-vecherinki", "kak-vybrat-programmu"],
  "podgotovka-k-priezdu-animatora": ["transformer-doma", "esli-rebenok-stesnyaetsya", "igry-shou-i-tort"],
  "podgotovka-pennoj-vecherinki": ["letnie-prazdniki-na-turbaze", "podgotovka-k-priezdu-animatora", "kakoe-shou-dobavit"],
  "animatsiya-po-vozrastu": ["kak-vybrat-geroya", "esli-rebenok-stesnyaetsya", "kak-vybrat-programmu"],
  "transformer-doma": ["podgotovka-k-priezdu-animatora", "kak-vybrat-geroya", "kakoe-shou-dobavit"],
  "kak-vybrat-programmu": ["stoimost-animatora", "animatsiya-po-vozrastu", "igry-shou-i-tort"],
  "esli-rebenok-stesnyaetsya": ["animatsiya-po-vozrastu", "kak-vybrat-geroya", "podgotovka-k-priezdu-animatora"],
  "kak-vybrat-geroya": ["animatsiya-po-vozrastu", "transformer-doma", "esli-rebenok-stesnyaetsya"],
  "igry-shou-i-tort": ["kak-vybrat-programmu", "kakoe-shou-dobavit", "podgotovka-k-priezdu-animatora"],
  "vypusknoy-dlya-gruppy": ["prazdniki-v-shkolnyh-lageryah", "igry-shou-i-tort", "kakoe-shou-dobavit"],
};

export function relatedArticles(slug: string, articles: Article[]): Article[] {
  const available = new Map(articles.map(article => [article.slug, article]));
  return [...new Set(related[slug] || [])]
    .filter(key => key !== slug)
    .flatMap(key => available.has(key) ? [available.get(key)!] : []);
}
