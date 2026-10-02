import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Article, Review, articleDate } from "@/lib/editorial";

export function ReviewCards({ reviews }: { reviews: Review[] }) {
  return <div className="review-grid">{reviews.map((review, index) => <figure className="review-card" key={`${review.author}-${index}`}><span className="review-quote" aria-hidden="true">“</span><blockquote>{review.text}</blockquote><figcaption><strong>{review.author}</strong>{review.source_url ? <a href={review.source_url} target="_blank" rel="noopener noreferrer">Страница на {review.source_label} <ArrowUpRight size={13} /></a> : <span>{review.source_label}</span>}</figcaption></figure>)}</div>;
}
export function ArticleCards({ articles }: { articles: Article[] }) {
  return <div className="article-grid">{articles.map((article, index) => <Link href={`/articles/${article.slug}`} className="article-card" key={article.slug}><div className="article-card-top"><span>Для родителей</span><ArrowUpRight size={22} /></div><span className="article-number" aria-hidden="true">0{index + 1}</span><h2>{article.title}</h2><p>{article.excerpt}</p><time dateTime={article.published_at}>{articleDate(article.published_at)}</time></Link>)}</div>;
}
