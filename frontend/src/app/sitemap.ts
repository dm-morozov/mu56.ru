import type { MetadataRoute } from "next";
import { getCharacters, getOfferings } from "@/lib/catalog";
import { getArticles } from "@/lib/editorial";
import { indexingEnabled, sitemapEntries } from "@/lib/seo";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled) return [];
  const [characters, offerings, articles] = await Promise.all([getCharacters(), getOfferings(), getArticles()]);
  return sitemapEntries(characters, offerings, articles);
}
