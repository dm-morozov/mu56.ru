import { getCharacters } from "@/lib/catalog";
import { CharacterCatalog } from "@/components/character-catalog";
import { PageIntro } from "@/components/page-intro";
import Link from "next/link";
export const metadata = { title: "Персонажи и аниматоры", description: "Выберите любимого героя для детского праздника в Оренбурге. Реальные костюмы, удобный поиск и подбор программы.", alternates: { canonical: "/characters" } };
export default async function CharactersPage() {
  const characters = await getCharacters();
  return <main id="main"><PageIntro eyebrow="Кажется, кто-то сейчас очень обрадуется" title="Кто придёт на ваш праздник?" description="Настоящие костюмы, любимые персонажи и игры для вашей компании. Посмотрите героев целиком, выберите любимого — а программу мы обсудим вместе." /><section className="container catalog-body"><div className="comparison-jump"><p>Выбираете аниматора впервые? Посмотрите, как проходит программа и что входит в стоимость.</p><Link href="/animators" className="button outline">Об анимации и ценах</Link></div><CharacterCatalog characters={characters} /></section></main>;
}
