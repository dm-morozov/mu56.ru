import { notFound } from "next/navigation";
import { getOfferings } from "@/lib/catalog";
import { PageIntro } from "@/components/page-intro";
import { OfferingDetails } from "@/components/offering-details";
import { CharacterGallery } from "@/components/character-gallery";
import { serviceSchema } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
export const metadata = { title: "Дед Мороз и Снегурочка", description: "Новогодние поздравления в Оренбурге: Дед Мороз и Снегурочка всегда вместе. Программы на 15, 30, 45 и 60 минут, выезд на вашу площадку.", alternates: { canonical: "/new-year" } };
export default async function NewYearPage() { const offerings = await getOfferings(), item = offerings.find(p => p.slug === "new-year"); if (!item) notFound(); return <main id="main"><StructuredData data={serviceSchema(item, "Дед Мороз и Снегурочка: новогоднее поздравление двумя героями на вашей площадке в Оренбурге.")} /><PageIntro title="Новогодняя сказка: Дед Мороз и Снегурочка" eyebrow="Новый год с Миром Улыбок" description="В этой программе всегда два героя вместе. Приедем домой, в детский сад, школу или на другую вашу площадку. Дату и формат поздравления согласуем заранее." /><OfferingDetails offering={item} allOfferings={offerings} /><CharacterGallery photos={item.characters.find(c => c.slug === "new-year-duo")?.photos} name="Дед Мороз и Снегурочка" /></main>; }
