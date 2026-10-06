"use client";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Character } from "@/lib/types";
import { CharacterCard } from "./cards";

const shortNames: Record<string, string> = { "Мультфильмы и сказки": "Мультфильмы", "Игровые и тематические программы": "Игры и тренды" };
const firstHeroes = ["spider-man", "tiktok", "captain-america", "chase"];
// Первые 12 позиций подтверждены владельцем; остальные — предварительный порядок.
const popularHeroes = [
  "bumblebee", "spider-man", "tiktok", "captain-america", "chase", "batman",
  "black-spider-man", "leon", "among-us", "superman", "creeper", "mcqueen",
  "new-year-duo", "optimus-prime", "iron-man", "ninja-turtle", "ladybug",
  "harry-potter", "cat-noir", "jack-sparrow", "football", "deadpool",
  "alice", "hatter", "aladdin", "clown-kesha", "graduation-host",
  "luke-skywalker", "prince", "hawaiian", "kutamba", "james-bond",
];
const categoryOrder = ["Большие герои", "Новый год", "Супергерои", "Игровые и тематические программы", "Приключения", "Мультфильмы и сказки"];
const categoryRank = (name: string) => { const index = categoryOrder.indexOf(name); return index < 0 ? categoryOrder.length : index; };
const heroRank = (slug: string) => { const index = firstHeroes.indexOf(slug); return index < 0 ? firstHeroes.length : index; };
const popularityRank = (slug: string) => { const index = popularHeroes.indexOf(slug); return index < 0 ? popularHeroes.length : index; };
type SortOrder = "category" | "popular" | "name";
export function CharacterCatalog({ characters }: { characters: Character[] }) {
  const [category, setCategory] = useState("Все герои"), [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("category");
  const categories = ["Все герои", ...Array.from(new Set(characters.map(item => item.category))).sort((a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b, "ru"))];
  const filtered = useMemo(() => {
    const matches = characters.filter(item => (category === "Все герои" || item.category === category) && item.name.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru")));
    return matches.sort((a, b) => {
      const byName = () => a.name.localeCompare(b.name, "ru") || a.slug.localeCompare(b.slug);
      if (sortOrder === "name") return byName();
      if (sortOrder === "popular") return popularityRank(a.slug) - popularityRank(b.slug) || byName();
      return categoryRank(a.category) - categoryRank(b.category) || a.category.localeCompare(b.category, "ru") || heroRank(a.slug) - heroRank(b.slug) || byName();
    });
  }, [characters, category, search, sortOrder]);
  return <>
    <div className="catalog-tools">
      <div className="catalog-search"><label htmlFor="character-search">Найти героя</label><div className="search-wrap"><Search size={20} /><input id="character-search" type="search" placeholder="Кто любимый герой вашего ребёнка?" value={search} onChange={event => setSearch(event.target.value)} />{search && <button aria-label="Очистить поиск" onClick={() => setSearch("")}><X size={17} /></button>}</div></div>
      <label className="catalog-sort"><span>Порядок героев</span><select value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)}><option value="category">По категориям</option><option value="popular">Популярные сначала</option><option value="name">По имени: А–Я</option></select></label>
    </div>
    <div className="category-tabs" aria-label="Категории персонажей">{categories.map(item => <button key={item} aria-pressed={item === category} onClick={() => setCategory(item)}>{shortNames[item] || item}</button>)}</div>
    <div className="catalog-results"><span className="catalog-count" aria-live="polite"><SlidersHorizontal size={16} /> Найдено: {filtered.length}</span><p className="catalog-sort-note">{sortOrder === "popular" ? "Сначала — самые востребованные герои «Мира Улыбок»." : sortOrder === "name" ? "Герои в алфавитном порядке." : "Большие герои → Новый год → супергерои → игры и тренды → приключения → мультфильмы."}</p></div>
    {filtered.length ? <div className="character-grid">{filtered.map((character, index) => <CharacterCard key={character.slug} character={character} index={index} />)}</div> : <div className="empty-search"><h2>Такого героя пока не нашли</h2><p>Попробуйте другое имя или посмотрите весь каталог.</p><button className="button outline" onClick={() => { setSearch(""); setCategory("Все герои"); }}>Показать всех</button></div>}
  </>;
}
