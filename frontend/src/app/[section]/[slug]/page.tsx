import { notFound } from "next/navigation";
import Link from "next/link";
import { getOfferings } from "@/lib/catalog";
import { OfferingDetails } from "@/components/offering-details";
import { PageIntro } from "@/components/page-intro";
import { serviceSchema, pageMetadata } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
import { CharacterGallery } from "@/components/character-gallery";
import { offeringGalleries } from "@/lib/offering-gallery";
import { PhotoGallery } from "@/components/photo-gallery";
import { ProgramQuestions } from "@/components/program-questions";
import { getOccasion } from "@/lib/occasions";
import { offeringSearchTitle, offeringSearchDescription } from "@/lib/offering-seo";
import { ProgramReading } from "@/components/program-reading";
import { TransformerReview } from "@/components/transformer-review";
const kinds: Record<string, string> = { packages: "package", transformers: "transformer", shows: "show", extras: "extra" };
export async function generateMetadata({ params }: { params: Promise<{ section: string; slug: string }> }) { const { section, slug } = await params; const item = (await getOfferings()).find(p => p.slug === slug && p.kind === kinds[section]); if (!item) return {title:"Программа не найдена"}; return pageMetadata(offeringSearchTitle(item), offeringSearchDescription(item), `/${section}/${slug}`); }
export default async function DetailPage({ params, searchParams }: { params: Promise<{ section: string; slug: string }>; searchParams: Promise<{ occasion?: string | string[] }> }) {
  const { section, slug } = await params, offerings = await getOfferings();
  const item = offerings.find(p => p.slug === slug && p.kind === kinds[section]); if (!item) notFound();
  const query = await searchParams;
  const requestedOccasion = typeof query.occasion === "string" ? getOccasion(query.occasion) : undefined;
  const occasion = item.kind === "package" && requestedOccasion?.programs.some(program => program === item.slug) ? requestedOccasion : undefined;
  const isTransformer = item.kind === "transformer";
  let intro = "Выберите состав праздника и обсудите с нами дату и площадку.";
  if (isTransformer && slug === "bumblebee") intro = offeringSearchDescription(item);
  if (isTransformer && slug === "optimus-prime") intro = "Пригласите аниматора Оптимуса Прайма на день рождения в Оренбурге. Посмотрите фото костюма, выберите напарника для большого робота и узнайте, хватит ли места дома.";
  return <main id="main">
    <StructuredData data={serviceSchema(item, item.description || `${item.name} на вашей площадке в Оренбурге.`)} />
    <PageIntro
      path={`/${section}/${slug}`}
      parents={[{ label: ({ packages: "Пакеты", transformers: "Трансформеры", shows: "Услуги", extras: "Дополнения к празднику" } as Record<string, string>)[section], href: `/${section}` }, ...(occasion ? [{ label: occasion.title, href: `/holidays/${occasion.slug}` }] : [])]}
      title={item.name}
      description={intro}
    />
    <OfferingDetails offering={item} allOfferings={offerings} occasion={occasion} />
    {isTransformer && <CharacterGallery photos={item.characters.find(c => c.slug === item.slug)?.photos} name={item.name} />}
    {isTransformer && (slug === "bumblebee" || slug === "optimus-prime") && <p className="container"><Link href="/transformers#video" className="text-link">Посмотреть видео праздника с Бамблби и Оптимусом →</Link></p>}
    {offeringGalleries[item.slug] && <PhotoGallery photos={offeringGalleries[item.slug]} title={`${item.name} на праздниках`} description="Настоящие фотографии из нашего архива: от первого удара до сладкого финала." />}
    {isTransformer && <>
      <TransformerReview storyKey={item.slug} />
      <ProgramQuestions program="transformers" />
    </>}
    <ProgramReading offering={item} />
  </main>;
}
