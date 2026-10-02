"use client";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Character } from "@/lib/types";
import { CharacterCard } from "./cards";

const shortNames: Record<string, string> = { "Мультфильмы и сказки": "Мультфильмы", "Игровые и тематические программы": "Игры и тренды" };
const firstHeroes = ["spider-man", "chase", "harry-potter", "alice", "nolik", "creeper", "korzhik", "ladybug"];
export function CharacterCatalog({ characters }: { characters: Character[] }) {
  const [category, setCategory] = useState("Все герои"), [search, setSearch] = useState("");
  const categories = ["Все герои", ...new Set(characters.map(item => item.category))];
  const filtered = useMemo(() => {
    const matches = characters.filter(item => (category === "Все герои" || item.category === category) && item.name.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru")));
    const rank = (slug: string) => { const position = firstHeroes.indexOf(slug); return position < 0 ? firstHeroes.length : position; };
    return category === "Все герои" ? matches.sort((a, b) => rank(a.slug) - rank(b.slug)) : matches;
  }, [characters, category, search]);
  return <>
    <div className="catalog-tools"><div className="search-wrap"><Search size={20} /><input type="search" aria-label="Найти персонажа" placeholder="Кто любимый герой вашего ребёнка?" value={search} onChange={event => setSearch(event.target.value)} />{search && <button aria-label="Очистить поиск" onClick={() => setSearch("")}><X size={17} /></button>}</div><span className="catalog-count" aria-live="polite"><SlidersHorizontal size={16} /> Найдено: {filtered.length}</span></div>
    <div className="category-tabs" aria-label="Категории персонажей">{categories.map(item => <button key={item} aria-pressed={item === category} onClick={() => setCategory(item)}>{shortNames[item] || item}</button>)}</div>
    {filtered.length ? <div className="character-grid">{filtered.map((character, index) => <CharacterCard key={character.slug} character={character} index={index} />)}</div> : <div className="empty-search"><h2>Такого героя пока не нашли</h2><p>Попробуйте другое имя или посмотрите весь каталог.</p><button className="button outline" onClick={() => { setSearch(""); setCategory("Все герои"); }}>Показать всех</button></div>}
  </>;
}
