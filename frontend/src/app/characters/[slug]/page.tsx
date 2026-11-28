import Image from "next/image";
import Link from "next/link";
import { Clock3, Sparkles } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";
import { getCharacters, getOfferings } from "@/lib/catalog";
import { characterImage, characterIsPhoto } from "@/lib/images";
import { CharacterGallery } from "@/components/character-gallery";
import { basePrice, duration, rubles } from "@/lib/types";
import { ChooseButton } from "@/components/choose-button";
import { PageIntro } from "@/components/page-intro";
import { StructuredData } from "@/components/structured-data";
import { CharacterPlanning } from "@/components/character-planning";
import { ExperienceLinks } from "@/components/experience-links";

import { absoluteUrl, characterCanonical, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const character = (await getCharacters()).find(c => c.slug === slug);
  if (!character) return {title:"Персонаж не найден"};
  let description = `${character.name} на день рождения и детский праздник в Оренбурге. ${character.description.split("\n")[0]}`;
  if (slug === "spider-man" || slug === "ninja-turtle") {
    const animation = (await getOfferings()).find(item =>
      item.kind === "animation" && item.characters.some(hero => hero.slug === slug)
    );
    const price = animation && basePrice(animation);
    const terms = [price && rubles(price), animation?.duration_minutes && duration(animation.duration_minutes)].filter(Boolean).join(", ");
    const subject = slug === "ninja-turtle" ? "Аниматор Черепашка-ниндзя Леонардо" : "Аниматор Человек-паук";
    const story = slug === "ninja-turtle" ? "Дети помогают Леонардо защитить город от Шреддера." : "Игровая миссия с супергероем у вас дома или на площадке.";
    description = `${subject} на день рождения в Оренбурге${terms ? ` — ${terms}` : ""}. ${story}`;
  }
  const metadata = pageMetadata(`Аниматор ${character.name} в Оренбурге`, description, characterCanonical(slug));
  const image = characterImage(slug);
  if (image) metadata.openGraph.images = [{url:absoluteUrl(image),alt:character.name}];
  return metadata;
}
export default async function CharacterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (["ded-moroz", "snegurochka", "new-year-duo"].includes(slug)) permanentRedirect("/new-year");
  if (["bumblebee", "optimus-prime", "iron-man"].includes(slug)) permanentRedirect(`/transformers/${slug}`);
  const [characters, offerings] = await Promise.all([getCharacters(), getOfferings()]);
  const character = characters.find(c => c.slug === slug); if (!character) notFound();
  const host = slug === "graduation-host";
  const special = offerings.find(p => p.slug === slug && p.kind === "transformer");
  const offering = special || offerings.find(p => p.kind === (character.category === "Новый год" ? "seasonal" : "animation"));
  const price = offering ? basePrice(offering) : undefined, src = characterImage(slug);
  const ordinaryAnimation = offering?.kind === "animation" && offering.characters.some(hero => hero.slug === slug);
  const birthdayHero = ordinaryAnimation && (slug === "ninja-turtle" || slug === "spider-man");
  const paragraphs = (character.description || "Расскажите, что нравится ребёнку и сколько будет гостей. Вместе подберём программу с этим персонажем.").split(/\r?\n\s*\n/).map(text => text.trim()).filter(Boolean);
  const useStoryIntro = birthdayHero && paragraphs.length > 1;
  const defaultIntro = special
    ? "Большой герой и второй герой в обычном костюме приезжают вместе. Игры, темп и формат общения подбираем под вашу компанию."
    : "Выездной аниматор на детский праздник в Оренбурге. Игры, темп и формат общения подбираем по возрасту, интересам и компании детей.";
  const schema = ordinaryAnimation ? {
    "@context":"https://schema.org", "@type":"Service", name:`Аниматор ${character.name} в Оренбурге`,
    description:character.description, url:absoluteUrl(characterCanonical(slug)),
    provider:{"@id":absoluteUrl("/#organization")}, areaServed:{"@type":"City",name:"Оренбург"},
    offers: price ? [{"@type":"Offer",price,priceCurrency:"RUB",url:absoluteUrl(characterCanonical(slug))}] : [],
  } : null;
  return <main id="main">{schema && <StructuredData data={schema} />}<PageIntro path={`/characters/${slug}`} parents={[{ label: "Персонажи", href: "/characters" }]} breadcrumbLabel={special?.name || character.name} title={birthdayHero ? `${character.name} на день рождения в Оренбурге` : special?.name || character.name} eyebrow={character.category} description={useStoryIntro ? paragraphs[0] : defaultIntro} /><div className="container detail-layout character-detail-layout"><div className={`detail-photo ${characterIsPhoto(slug) ? "photo-mode" : ""} ${host ? "host-portrait" : ""}`}>{src ? <Image sizes="(max-width: 900px) 100vw, 600px" src={src} alt={host ? "Дмитрий Морозов, основатель «Мира Улыбок»" : character.name} width="500" height="700" /> : <h2>Программа с ведущим</h2>}</div><div className="detail-copy character-offer">{host && <p>На изображении — стилизованный образ Дмитрия Морозова, основателя «Мира Улыбок», созданный на основе его портрета. Программу проводит команда; ведущего согласуем для вашей даты.</p>}{ordinaryAnimation && <div className="detail-badges"><span className="small-badge"><Clock3 size={14} aria-hidden="true" />{duration(offering.duration_minutes)} анимации</span><span className="small-badge"><Sparkles size={14} aria-hidden="true" />Игры по возрасту</span></div>}<div className="detail-price">{price ? rubles(price) : "Подберём программу"}<small>{special ? "два героя · 1 час" : character.category === "Новый год" ? "поздравление на выбор" : "за программу"}</small></div><p>{special ? "В цену входит час программы с двумя героями. После встречи можно добавить шоу — состав и доплаты указаны на полной странице программы." : ordinaryAnimation ? `В цену входит ${duration(offering.duration_minutes)} программы: знакомство с героем и игры по возрасту. ${offering.included_performers === 1 ? "Программу проводит один аниматор" : `Программу проводят ${offering.included_performers} аниматора`}. Шоу и дополнительные услуги выбираются отдельно — итог появится в форме.` : "Можно выбрать обычную анимацию или праздник с шоу. Стоимость пакета зависит от состава."}</p>{special && <Link href={`/transformers/${slug}`} className="text-link">Программа, шоу и цены</Link>}{character.availability !== "available" && <p>{character.availability_label}</p>}<ChooseButton offering={offering?.slug} character={special ? undefined : character.slug}>Хочу этого героя</ChooseButton><p className="detail-terms">Оплата после праздника. Не понравится — можете не платить.<br />Выезд в удалённые районы рассчитывается отдельно.</p></div><div className="detail-copy character-story"><h2>{birthdayHero ? "Как проходят игры с детьми" : special ? "Большой герой + второй герой на выбор" : "Встреча, которую ждали"}</h2><div className="character-description">{(useStoryIntro ? paragraphs.slice(1) : paragraphs).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></div></div><CharacterGallery photos={character.photos} name={character.name} />{ordinaryAnimation && <CharacterPlanning character={character} offerings={offerings} />}{slug === "tiktok" && <ExperienceLinks />}</main>;
}
