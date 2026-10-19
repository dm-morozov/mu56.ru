import type { Review } from "./editorial";

/** A short existing testimonial; its published API record remains the only copy.
 * The public API has no review ID. Treat an ambiguous attribution as unavailable
 * rather than silently replacing it with another customer's story.
 */
export function homeReview(reviews: readonly Review[]): Review | undefined {
  const candidates = reviews.filter(review => {
    if (review.author.trim() !== "Андрей" || !/^(avito|авито)$/iu.test(review.source_label.trim()) || !review.text.trim()) return false;
    try {
      const source = new URL(review.source_url);
      return source.protocol === "https:" && !source.username && !source.password &&
        ["avito.ru", "www.avito.ru"].includes(source.hostname) && /^\/brands\/[^/]+(?:\/|$)/u.test(source.pathname);
    } catch { return false; }
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}
