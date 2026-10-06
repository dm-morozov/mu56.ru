import { notFound } from "next/navigation";
import { getOfferings } from "@/lib/catalog";
import { OfferingDetails } from "@/components/offering-details";
import { PageIntro } from "@/components/page-intro";
import { serviceSchema, pageMetadata } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
import { CharacterGallery } from "@/components/character-gallery";
const kinds: Record<string, string> = { packages: "package", transformers: "transformer", shows: "show", extras: "extra" };
export async function generateMetadata({ params }: { params: Promise<{ section: string; slug: string }> }) { const { section, slug } = await params; const item = (await getOfferings()).find(p => p.slug === slug && p.kind === kinds[section]); if (!item) return {title:"Программа не найдена"}; return pageMetadata(item.name, `${item.name} на праздник в Оренбурге. ${item.description || "Выездная программа на вашей площадке. Состав, продолжительность и подтверждённые цены. Оплата после праздника."}`, `/${section}/${slug}`); }
export default async function DetailPage({ params }: { params: Promise<{ section: string; slug: string }> }) {
  const { section, slug } = await params, offerings = await getOfferings();
  const item = offerings.find(p => p.slug === slug && p.kind === kinds[section]); if (!item) notFound();
  return <main id="main"><StructuredData data={serviceSchema(item, item.description || `${item.name} на вашей площадке в Оренбурге.`)} /><PageIntro path={`/${section}/${slug}`} parents={[{ label: ({ packages: "Пакеты", transformers: "Трансформеры", shows: "Услуги", extras: "Дополнения к празднику" } as Record<string, string>)[section], href: `/${section}` }]} title={item.name} description="Выберите состав праздника и обсудите с нами дату и площадку." /><OfferingDetails offering={item} allOfferings={offerings} />{item.kind === "transformer" && <CharacterGallery photos={item.characters.find(c => c.slug === item.slug)?.photos} name={item.name} />}</main>;
}
