import type { Character, Offering } from "./types";
import { contacts } from "./contacts";

export const siteOrigin = new URL(process.env.SITE_URL || "https://mu56.ru").origin;
export const indexingEnabled = process.env.SITE_INDEXING_ENABLED === "true";
export function crawlerRules(enabled: boolean) {
  if (!enabled) return [{ userAgent: "*", disallow: "/" }];
  return [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/privacy", "/consent"] }, { userAgent: "OAI-SearchBot", allow: "/", disallow: ["/api/", "/admin/", "/privacy", "/consent"] }];
}
export const absoluteUrl = (path: string) => new URL(path, `${siteOrigin}/`).href;
export const socialPreviewImage: { url: string; alt: string; width?: number; height?: number; type?: string } = {
  url: absoluteUrl("/media/social-preview-20261008-v2.jpg"),
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Мир Улыбок — праздник, который дети не забудут. Аниматоры, трансформеры и шоу в Оренбурге.",
};
export const servicePath = (kind: string, slug: string) => ({ animation: "/animators", transformer: `/transformers/${slug}`, package: `/packages/${slug}`, show: `/shows/${slug}`, extra: `/extras/${slug}`, seasonal: "/new-year" } as Record<string, string>)[kind];
export const characterCanonical = (slug: string) => ["bumblebee", "optimus-prime", "iron-man"].includes(slug) ? `/transformers/${slug}` : ["ded-moroz", "snegurochka", "new-year-duo"].includes(slug) ? "/new-year" : `/characters/${slug}`;
export const shortDescription = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 180);
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
export function pageMetadata(title: string, description: string, path: string) {
  return { title, description: shortDescription(description), alternates: { canonical: path }, openGraph: { title, description: shortDescription(description), url: absoluteUrl(path), type: "website" as const, locale: "ru_RU", siteName: "Мир Улыбок", images: [socialPreviewImage] } };
}
export const organization = {
  "@context": "https://schema.org", "@type": "Organization", "@id": absoluteUrl("/#organization"),
  name: "Мир Улыбок", url: absoluteUrl("/"), telephone: "+79033922229",
  logo: absoluteUrl("/media/logo-kite.svg"), areaServed: { "@type": "City", name: "Оренбург" },
  sameAs: Object.values(contacts),
};
export function serviceSchema(item: Offering, description: string) {
  const path = servicePath(item.kind, item.slug);
  return { "@context": "https://schema.org", "@type": "Service", name: item.name, description,
    url: absoluteUrl(path), provider: { "@id": absoluteUrl("/#organization") }, areaServed: { "@type": "City", name: "Оренбург" },
    offers: item.prices.filter(p => p.context === "base" && p.amount_rub > 0).map(p => ({ "@type": "Offer", name: p.label, price: p.amount_rub, priceCurrency: "RUB", url: absoluteUrl(path) })),
  };
}
export function sitemapEntries(characters: Character[], offerings: Offering[], articles: {slug: string}[]) {
  const paths = ["/", "/animators", "/transformers", "/packages", "/characters", "/shows", "/extras", "/new-year", "/gallery", "/contacts", "/reviews", "/articles", "/holidays", "/holidays/kindergarten", "/holidays/graduation", "/holidays/large-events",
    ...characters.map(c => characterCanonical(c.slug)), ...offerings.map(o => servicePath(o.kind, o.slug)).filter(Boolean), ...articles.map(a => `/articles/${a.slug}`)];
  return [...new Set(paths)].map(path => ({ url: absoluteUrl(path) }));
}

