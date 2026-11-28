import Link from "next/link";
import { ReviewCard } from "@/components/editorial-cards";
import { getReviews } from "@/lib/editorial";

// Match the chosen published stories by their defining details, without copying review text.
const stories = new Map([
  ["bumblebee", { title: "Бамблби на дне рождения на футбольном поле", matches: [/бамблби/iu, /футбольном поле/iu] }],
  ["optimus-prime", { title: "Оптимус Прайм и Человек-паук на празднике", matches: [/оптимус/iu, /человек[\s+-]+паук/iu] }],
]);

export async function TransformerReview({ slug }: { slug: string }) {
  const story = stories.get(slug);
  if (!story) return null;

  const reviews = await getReviews().catch(() => []);
  const review = reviews.find(item =>
    item.source_label === "Avito" && story.matches.every(pattern => pattern.test(item.text))
  );
  if (!review) return null;

  return <section className="section container" aria-labelledby="transformer-review-title">
    <div className="section-head">
      <h2 id="transformer-review-title">{story.title}</h2>
      <Link className="text-link" href="/reviews">Все отзывы →</Link>
    </div>
    <ReviewCard review={review} />
  </section>;
}
