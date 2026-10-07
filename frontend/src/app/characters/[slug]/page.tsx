import Image from "next/image";
import Link from "next/link";
import { Clock3, Sparkles } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";
import { getCharacters, getOfferings } from "@/lib/catalog";
import { characterImage, characterIsPhoto } from "@/lib/images";
import { CharacterGallery } from "@/components/character-gallery";
import { basePrice, rubles } from "@/lib/types";
import { ChooseButton } from "@/components/choose-button";
import { PageIntro } from "@/components/page-intro";
import { StructuredData } from "@/components/structured-data";
import { CharacterPlanning } from "@/components/character-planning";

import { absoluteUrl, characterCanonical, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const character = (await getCharacters()).find(c => c.slug === slug);
  if (!character) return {title:"Персонаж не найден"};
  const metadata = pageMetadata(`Аниматор ${character.name} в Оренбурге`, `${character.name} на день рождения и детский праздник в Оренбурге. ${character.description.split("\n")[0]}`, characterCanonical(slug));
  const image = characterImage(slug);
  if (image) metadata.openGraph.images = [{url:absoluteUrl(image),alt:character.name}];
  return metadata;
}
export default async function CharacterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (["ded-moroz", "snegurochka", "new-year-duo"].includes(slug)) permanentRedirect("/new-year");
  const [characters, offerings] = await Promise.all([getCharacters(), getOfferings()]);
  const character = characters.find(c => c.slug === slug); if (!character) notFound();
  const host = slug === "graduation-host";
  const special = offerings.find(p => p.slug === slug && p.kind === "transformer");
  const offering = special || offerings.find(p => p.kind === (character.category === "Новый год" ? "seasonal" : "animation"));
  const price = offering ? basePrice(offering) : undefined, src = characterImage(slug);
  const ordinaryAnimation = offering?.kind === "animation" && offering.characters.some(hero => hero.slug === slug);
  const schema = ordinaryAnimation ? {
    "@context":"https://schema.org", "@type":"Service", name:`Аниматор ${character.name} в Оренбурге`,
    description:character.description, url:absoluteUrl(characterCanonical(slug)),
    provider:{"@id":absoluteUrl("/#organization")}, areaServed:{"@type":"City",name:"Оренбург"},
    offers: price ? [{"@type":"Offer",price,priceCurrency:"RUB",url:absoluteUrl(characterCanonical(slug))}] : [],
  } : null;
  return <main id="main">{schema && <StructuredData data={schema} />}<PageIntro path={`/characters/${slug}`} parents={[{ label: "Персонажи", href: "/characters" }]} title={special?.name || character.name} eyebrow={character.category} description={special ? "Большой герой и второй герой в обычном костюме приезжают вместе. Игры, темп и формат общения подбираем под вашу компанию." : "Выездной аниматор на детский праздник в Оренбурге. Игры, темп и формат общения подбираем по возрасту, интересам и компании детей."} /><div className="container detail-layout character-detail-layout"><div className={`detail-photo ${characterIsPhoto(slug) ? "photo-mode" : ""} ${host ? "host-portrait" : ""}`}>{src ? <Image sizes="(max-width: 900px) 100vw, 600px" src={src} alt={host ? "Дмитрий Морозов, основатель «Мира Улыбок»" : character.name} width="500" height="700" /> : <h2>Программа с ведущим</h2>}</div><div className="detail-copy character-offer">{host && <p>На фотографии — Дмитрий Морозов, основатель «Мира Улыбок». Программу проводит команда; ведущего согласуем для вашей даты.</p>}{ordinaryAnimation && <div className="detail-badges"><span className="small-badge"><Clock3 size={14} aria-hidden="true" />1 час анимации</span><span className="small-badge"><Sparkles size={14} aria-hidden="true" />Игры по возрасту</span></div>}<div className="detail-price">{price ? rubles(price) : "Подберём программу"}<small>{special ? "два героя · 1 час" : character.category === "Новый год" ? "поздравление на выбор" : "за программу"}</small></div><p>{special ? "В цену входит час программы с двумя героями. После встречи можно добавить шоу — состав и доплаты указаны на полной странице программы." : "Можно выбрать обычную анимацию или праздник с шоу. Стоимость пакета зависит от состава."}</p>{special && <Link href={`/transformers/${slug}`} className="text-link">Программа, шоу и цены</Link>}{character.availability !== "available" && <p>{character.availability_label}</p>}<ChooseButton offering={offering?.slug} character={special ? undefined : character.slug}>Хочу этого героя</ChooseButton><p className="detail-terms">Оплата после праздника. Не понравится — можете не платить.<br />Выезд в удалённые районы рассчитывается отдельно.</p></div><div className="detail-copy character-story"><h2>{special ? "Большой герой + второй герой на выбор" : "Встреча, которую ждали"}</h2><div className="character-description">{(character.description || "Расскажите, что нравится ребёнку и сколько будет гостей. Вместе подберём программу с этим персонажем.").split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></div></div><CharacterGallery photos={character.photos} name={character.name} />{ordinaryAnimation && <CharacterPlanning character={character} offerings={offerings} />}</main>;
}
