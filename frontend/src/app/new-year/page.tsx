import { notFound } from "next/navigation";
import { getOfferings } from "@/lib/catalog";
import { PageIntro } from "@/components/page-intro";
import { CharacterGallery } from "@/components/character-gallery";
import { NewYearExtras } from "@/components/new-year-extras";
import { OfferingDetails } from "@/components/offering-details";
import { pageMetadata, serviceSchema } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
import { ProgramQuestions } from "@/components/program-questions";
import { DeferredVideo } from "@/components/deferred-video";
const newYearMetadata = pageMetadata(
  "Дед Мороз и Снегурочка в Оренбурге",
  "Дед Мороз и Снегурочка вместе: поздравления на дому, в саду и школе в Оренбурге. Сравните программы, цены и тарифы на 31 декабря. Подарки для вручения передают родители.",
  "/new-year",
);
export const metadata = {
  ...newYearMetadata,
  openGraph: {
    ...newYearMetadata.openGraph,
    images: [{ url: "/media/new-year/duo-studio.jpg", width: 1024, height: 1536, alt: "Дед Мороз и Снегурочка — Мир Улыбок" }],
  },
};
export default async function NewYearPage() { const offerings = await getOfferings(), item = offerings.find(p => p.slug === "new-year"); if (!item) notFound(); return <main id="main"><StructuredData data={serviceSchema(item, "Дед Мороз и Снегурочка: новогоднее поздравление двумя героями на вашей площадке в Оренбурге.")} /><PageIntro path="/new-year" breadcrumbLabel="Новый год" title="Дед Мороз и Снегурочка в Оренбурге" eyebrow="Новый год с Миром Улыбок" description="В этой программе всегда два героя вместе. Приедем домой, в детский сад, школу или на другую вашу площадку. Дату и формат поздравления согласуем заранее." /><OfferingDetails offering={item} allOfferings={offerings} /><section className="container character-gallery new-year-video-section"><div className="section-head"><div><span className="eyebrow">Такие встречи уже случались</span><h2>Новогодняя встреча — в видео</h2></div><p>Посмотрите видео с нашей новогодней встречи. Атмосфера праздника — в движении, голосах и улыбках.</p></div><figure className="new-year-video"><DeferredVideo src="/media/new-year/new-year-party.mp4" poster="/media/new-year/video-poster-studio.webp" label="Видео новогодней встречи с Дедом Морозом и Снегурочкой" /><figcaption>Новогодняя встреча с Миром Улыбок. Нажмите на воспроизведение, чтобы посмотреть видео со звуком.</figcaption></figure></section><CharacterGallery photos={item.characters.find(character => character.slug === "new-year-duo")?.photos} name="Дед Мороз и Снегурочка" /><NewYearExtras offerings={offerings} /><ProgramQuestions program="new-year" /></main>; }
