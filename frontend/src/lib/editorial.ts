import { cache } from "react";
import { allPages } from "./catalog";

export type Review = { author: string; text: string; source_label: string; source_url: string };
export type Article = { slug: string; title: string; excerpt: string; published_at: string };
export type ArticleDetail = Article & { body: string; seo_title: string; seo_description: string; related_offering: { slug: string; name: string; kind: string } | null };
export const getReviews = cache(() => allPages<Review>("reviews"));
export const getArticles = cache(() => allPages<Article>("articles"));
export const getArticle = cache(async (slug: string): Promise<ArticleDetail | null> => {
  const response = await fetch(`${process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000"}/api/v1/articles/${encodeURIComponent(slug)}/`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Article unavailable: ${response.status}`);
  return response.json();
});
export const articleDate = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "Asia/Yekaterinburg" }).format(new Date(value));
