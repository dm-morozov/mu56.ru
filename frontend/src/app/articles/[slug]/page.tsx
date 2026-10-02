import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, articleDate } from "@/lib/editorial";
import { offeringUrl } from "@/lib/images";
import { ChooseButton } from "@/components/choose-button";

import { absoluteUrl } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, article = await getArticle(slug);
  if (!article) return { title: "Статья не найдена" };
  return { title: article.seo_title || article.title, description: article.seo_description || article.excerpt, alternates: { canonical: `/articles/${slug}` }, openGraph: { type: "article", title: article.title, description: article.excerpt, publishedTime: article.published_at } };
}
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, article = await getArticle(slug);
  if (!article) notFound();
  return <main id="main"><StructuredData data={{"@context":"https://schema.org","@type":"Article",headline:article.title,description:article.excerpt,datePublished:article.published_at,author:{"@type":"Organization",name:"Мир Улыбок"},publisher:{"@id":absoluteUrl("/#organization")},mainEntityOfPage:absoluteUrl(`/articles/${slug}`),inLanguage:"ru-RU"}} /><article className="container article-detail"><nav className="breadcrumbs" aria-label="Навигация по странице"><Link href="/">Главная</Link><span>/</span><Link href="/articles">Идеи для родителей</Link></nav><header><span className="eyebrow">Мир Улыбок · Для родителей</span><h1>{article.title}</h1><p className="article-lead">{article.excerpt}</p><time dateTime={article.published_at}>{articleDate(article.published_at)}</time></header><div className="article-body">{article.body.split(/\n\s*\n/).filter(Boolean).map((block, index) => block.startsWith("## ") ? <h2 key={index}>{block.slice(3)}</h2> : <p key={index}>{block}</p>)}</div><aside className="article-cta"><span className="eyebrow">От идеи — к празднику</span><h2>Обсудим вашу программу?</h2><p>Расскажите о ребёнке, гостях и площадке — вместе выберем формат.</p>{article.related_offering && <Link className="text-link" href={offeringUrl(article.related_offering.kind, article.related_offering.slug)}>{article.related_offering.name} →</Link>}<ChooseButton offering={article.related_offering?.slug}>Обсудить праздник</ChooseButton></aside><Link className="text-link" href="/articles">← Все статьи</Link></article></main>;
}
